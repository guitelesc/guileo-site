/* GUILEO DESK — o CAIXA (2026-10-04). Fechar a conta no balcão em segundos: cliente, itens, gorjeta,
   pagamento dividido e recibo. Substitui o checkout do MindBody/Booksy, mais simples e mais rápido.

   🚨 REGRAS DA CASA QUE ESTA TELA SEGUE
   · Preço de serviço/produto/pacote vem do CADASTRO (o banco recalcula). A tela só deixa digitar valor
     onde o servidor aceita: serviço "sob consulta" (preço 0), vale-presente, gorjeta e item avulso.
   · "Falta" tem de chegar a exatamente 0 antes de o botão Cobrar acender — o banco recusa o resto.
   · Um request_id por abertura: clicar duas vezes / repetir depois de queda de rede = a MESMA venda.
   · Sucesso só com d.ok === true. Recibo "enviado" só com recibo.ok (id da Resend) — senão, diz que não foi.
   · Sem conexão: amostra DECLARADA, tudo funciona na tela, Cobrar não grava nada.
   · Dinheiro só por dinheiro()/centavos() de deskApi.js. Textos nos 4 idiomas (T abaixo).
   · Cartão salvo / taxa de falta / assinatura: DeskPagamentosOnline.jsx (Stripe DO NEGÓCIO, 2026-10-05). */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "../lib/portalApi.js";
import { Drawer, SectionSkeleton } from "../pages/Portal.jsx";
import { chamarDesk, motivo, dinheiro, centavos, tx, ehRecepcao, quando } from "./deskApi.js";
import DeskPagamentosOnline from "./DeskPagamentosOnline.jsx";

// ── textos ───────────────────────────────────────────────────────────────────────────────────
const T = {
  title: { en: "Checkout", pt: "Caixa", es: "Cobro", hi: "चेकआउट" },
  walkin: { en: "Walk-in sale", pt: "Venda avulsa", es: "Venta sin cita", hi: "वॉक-इन बिक्री" },
  fromAppt: { en: "From the appointment", pt: "Do agendamento", es: "De la cita", hi: "अपॉइंटमेंट से" },
  sample: { en: "Sample checkout — connect your account to charge for real. Nothing here is saved.", pt: "Caixa de exemplo — conecte a sua conta para cobrar de verdade. Nada aqui é gravado.", es: "Cobro de ejemplo — conecta tu cuenta para cobrar de verdad. Nada aquí se guarda.", hi: "नमूना चेकआउट — असली चार्ज के लिए अपना खाता जोड़ें। यहाँ कुछ भी सेव नहीं होता।" },
  sampleToast: { en: "This is a sample — nothing was charged or saved.", pt: "Isto é uma amostra — nada foi cobrado nem gravado.", es: "Esto es una muestra — no se cobró ni se guardó nada.", hi: "यह नमूना है — कुछ भी चार्ज या सेव नहीं हुआ।" },
  already: { en: "This appointment already has a sale. A new one will be a second sale.", pt: "Este agendamento já tem uma venda. Uma nova será uma segunda venda.", es: "Esta cita ya tiene una venta. Una nueva será una segunda venta.", hi: "इस अपॉइंटमेंट की बिक्री पहले से है। नई बिक्री दूसरी होगी।" },
  // cliente
  client: { en: "Client", pt: "Cliente", es: "Cliente", hi: "ग्राहक" },
  name: { en: "Name", pt: "Nome", es: "Nombre", hi: "नाम" },
  contact: { en: "Phone or email", pt: "Telefone ou e-mail", es: "Teléfono o correo", hi: "फ़ोन या ईमेल" },
  find: { en: "Find a client by name, phone or email…", pt: "Procurar cliente por nome, telefone ou e-mail…", es: "Buscar cliente por nombre, teléfono o correo…", hi: "नाम, फ़ोन या ईमेल से ग्राहक खोजें…" },
  searching: { en: "Searching…", pt: "Procurando…", es: "Buscando…", hi: "खोज रहे हैं…" },
  noMatch: { en: "No client found.", pt: "Nenhuma cliente encontrada.", es: "No se encontró cliente.", hi: "कोई ग्राहक नहीं मिला।" },
  searchFail: { en: "Search didn't work. Type again.", pt: "A busca não funcionou. Digite de novo.", es: "La búsqueda falló. Escribe de nuevo.", hi: "खोज नहीं हुई। फिर से लिखें।" },
  cardLoading: { en: "Reading the client card…", pt: "Lendo a ficha da cliente…", es: "Leyendo la ficha de la clienta…", hi: "ग्राहक कार्ड पढ़ रहे हैं…" },
  cardFail: { en: "Couldn't read the client card.", pt: "Não consegui ler a ficha da cliente.", es: "No pude leer la ficha de la clienta.", hi: "ग्राहक कार्ड नहीं पढ़ पाया।" },
  allergies: { en: "Allergies", pt: "Alergias", es: "Alergias", hi: "एलर्जी" },
  alerts: { en: "Alerts", pt: "Alertas", es: "Alertas", hi: "अलर्ट" },
  packages: { en: "Packages", pt: "Pacotes", es: "Paquetes", hi: "पैकेज" },
  left: { en: "left", pt: "restam", es: "quedan", hi: "बचे" },
  useSession: { en: "Use a session", pt: "Usar uma sessão", es: "Usar una sesión", hi: "एक सत्र इस्तेमाल करें" },
  // desk_v13: validade, ativação e serviço que debita mais de uma sessão
  expiresOn: { en: "expires", pt: "vence", es: "vence", hi: "समाप्ति" },
  expiredOn: { en: "expired", pt: "venceu", es: "venció", hi: "समाप्त" },
  expiredBadge: { en: "Expired", pt: "Vencido", es: "Vencido", hi: "समाप्त" },
  notActivated: { en: "activates on first visit", pt: "ativa na 1ª visita", es: "se activa en la 1ª visita", hi: "पहली विज़िट पर सक्रिय" },
  pkgShortMsg: { en: "Not enough sessions on {pkg}: {left} left, {svc} uses {n}.", pt: "Faltam sessões em {pkg}: restam {left}, {svc} usa {n}.", es: "Faltan sesiones en {pkg}: quedan {left}, {svc} usa {n}.", hi: "{pkg} में पर्याप्त सत्र नहीं: {left} बचे, {svc} {n} लेती है।" },
  pkgShortDetail: { en: "({left} left, needs {n})", pt: "(restam {left}, precisa de {n})", es: "(quedan {left}, necesita {n})", hi: "({left} बचे, {n} चाहिए)" },
  giftCards: { en: "Gift cards", pt: "Vales-presente", es: "Tarjetas regalo", hi: "गिफ्ट कार्ड" },
  useGift: { en: "Use", pt: "Usar", es: "Usar", hi: "इस्तेमाल करें" },
  needServiceForPkg: { en: "Add the service first, then use the session.", pt: "Adicione o serviço primeiro, depois use a sessão.", es: "Agrega el servicio primero y luego usa la sesión.", hi: "पहले सेवा जोड़ें, फिर सत्र इस्तेमाल करें।" },
  pkgNoMore: { en: "No more sessions of this package for this sale.", pt: "Não há mais sessões deste pacote para esta venda.", es: "No hay más sesiones de este paquete para esta venta.", hi: "इस बिक्री के लिए इस पैकेज में और सत्र नहीं हैं।" },
  // itens
  items: { en: "Items", pt: "Itens", es: "Artículos", hi: "आइटम" },
  k_service: { en: "Service", pt: "Serviço", es: "Servicio", hi: "सेवा" },
  k_product: { en: "Product", pt: "Produto", es: "Producto", hi: "प्रोडक्ट" },
  k_package: { en: "Package", pt: "Pacote", es: "Paquete", hi: "पैकेज" },
  k_giftcard: { en: "Gift card", pt: "Vale-presente", es: "Tarjeta regalo", hi: "गिफ्ट कार्ड" },
  k_custom: { en: "Custom item", pt: "Item avulso", es: "Artículo libre", hi: "अन्य आइटम" },
  pickService: { en: "Choose a service…", pt: "Escolha um serviço…", es: "Elige un servicio…", hi: "सेवा चुनें…" },
  pickProduct: { en: "Choose a product…", pt: "Escolha um produto…", es: "Elige un producto…", hi: "प्रोडक्ट चुनें…" },
  pickPackage: { en: "Choose a package…", pt: "Escolha um pacote…", es: "Elige un paquete…", hi: "पैकेज चुनें…" },
  noProducts: { en: "No products registered yet.", pt: "Nenhum produto cadastrado ainda.", es: "Aún no hay productos.", hi: "अभी कोई प्रोडक्ट नहीं है।" },
  noPackages: { en: "No packages registered yet.", pt: "Nenhum pacote cadastrado ainda.", es: "Aún no hay paquetes.", hi: "अभी कोई पैकेज नहीं है।" },
  sessions: { en: "sessions", pt: "sessões", es: "sesiones", hi: "सत्र" },
  pro: { en: "Professional", pt: "Profissional", es: "Profesional", hi: "प्रोफ़ेशनल" },
  soldBy: { en: "Sold by", pt: "Vendido por", es: "Vendido por", hi: "किसने बेचा" },
  nobody: { en: "Nobody", pt: "Ninguém", es: "Nadie", hi: "कोई नहीं" },
  inStock: { en: "in stock", pt: "em estoque", es: "en stock", hi: "स्टॉक में" },
  outStock: { en: "out of stock", pt: "sem estoque", es: "sin stock", hi: "स्टॉक खत्म" },
  onRequestShort: { en: "price on request", pt: "sob consulta", es: "a consultar", hi: "कीमत पूछने पर" },
  onRequest: { en: "Price on request — type the price", pt: "Preço sob consulta — digite o valor", es: "Precio a consultar — escribe el precio", hi: "कीमत पूछने पर — कीमत लिखें" },
  price: { en: "Price", pt: "Valor", es: "Precio", hi: "कीमत" },
  qty: { en: "Qty", pt: "Qtd", es: "Cant.", hi: "मात्रा" },
  lineDisc: { en: "Discount", pt: "Desconto", es: "Descuento", hi: "छूट" },
  addDisc: { en: "+ discount", pt: "+ desconto", es: "+ descuento", hi: "+ छूट" },
  remove: { en: "Remove", pt: "Tirar", es: "Quitar", hi: "हटाएँ" },
  giftAmount: { en: "Gift card amount", pt: "Valor do vale", es: "Monto de la tarjeta", hi: "गिफ्ट कार्ड राशि" },
  recipient: { en: "For whom (optional — phone or email)", pt: "Para quem (opcional — telefone ou e-mail)", es: "Para quién (opcional — teléfono o correo)", hi: "किसके लिए (वैकल्पिक — फ़ोन या ईमेल)" },
  giftMin: { en: "Minimum", pt: "Mínimo", es: "Mínimo", hi: "न्यूनतम" },
  codeLater: { en: "The code is created when the sale closes.", pt: "O código nasce quando a venda fecha.", es: "El código se crea al cerrar la venta.", hi: "कोड बिक्री पूरी होने पर बनता है।" },
  customName: { en: "What is it?", pt: "O que é?", es: "¿Qué es?", hi: "यह क्या है?" },
  amount: { en: "Amount", pt: "Valor", es: "Monto", hi: "राशि" },
  empty: { en: "Add a service, product, package or gift card.", pt: "Adicione um serviço, produto, pacote ou vale.", es: "Agrega un servicio, producto, paquete o tarjeta regalo.", hi: "सेवा, प्रोडक्ट, पैकेज या गिफ्ट कार्ड जोड़ें।" },
  catalogFail: { en: "I couldn't read your products and packages.", pt: "Não consegui ler os seus produtos e pacotes.", es: "No pude leer tus productos y paquetes.", hi: "आपके प्रोडक्ट और पैकेज नहीं पढ़ पाया।" },
  retry: { en: "Try again", pt: "Tentar de novo", es: "Intentar de nuevo", hi: "फिर कोशिश करें" },
  // gorjeta
  tip: { en: "Tip", pt: "Gorjeta", es: "Propina", hi: "टिप" },
  noTip: { en: "None", pt: "Sem", es: "Sin", hi: "नहीं" },
  customTip: { en: "Other", pt: "Outro", es: "Otro", hi: "अन्य" },
  tipBase: { en: "on services", pt: "sobre serviços", es: "sobre servicios", hi: "सेवाओं पर" },
  tipTo: { en: "Tip goes to", pt: "A gorjeta vai para", es: "La propina va para", hi: "टिप किसे मिलेगी" },
  split: { en: "Split evenly", pt: "Dividir igual", es: "Dividir por igual", hi: "बराबर बाँटें" },
  // totais
  subtotal: { en: "Subtotal", pt: "Subtotal", es: "Subtotal", hi: "उप-योग" },
  discount: { en: "Discount", pt: "Desconto", es: "Descuento", hi: "छूट" },
  tax: { en: "Tax %", pt: "Imposto %", es: "Impuesto %", hi: "टैक्स %" },
  total: { en: "Total", pt: "Total", es: "Total", hi: "कुल" },
  // cupom (desk_v14) — o MESMO cupom de Cupons & Campanhas; o servidor calcula e confere o desconto
  coupon: { en: "Coupon", pt: "Cupom", es: "Cupón", hi: "कूपन" },
  couponPh: { en: "Coupon code", pt: "Código do cupom", es: "Código del cupón", hi: "कूपन कोड" },
  apply: { en: "Apply", pt: "Aplicar", es: "Aplicar", hi: "लागू करें" },
  checking: { en: "Checking…", pt: "Conferindo…", es: "Verificando…", hi: "जाँच रहे हैं…" },
  cupPct: { en: "{v}% on {base}", pt: "{v}% sobre {base}", es: "{v}% sobre {base}", hi: "{base} पर {v}%" },
  cupAmt: { en: "{v} off", pt: "{v} de desconto", es: "{v} de descuento", hi: "{v} की छूट" },
  cupCapped: { en: "{v} off — limited to this bill", pt: "{v} de desconto — limitado ao valor da conta", es: "{v} de descuento — limitado al valor de la cuenta", hi: "{v} की छूट — इस बिल तक सीमित" },
  cupUses: { en: "used {n} of {max}", pt: "usado {n} de {max}", es: "usado {n} de {max}", hi: "{max} में से {n} बार इस्तेमाल" },
  cupUsesFree: { en: "used {n}×", pt: "usado {n}×", es: "usado {n}×", hi: "{n}× इस्तेमाल" },
  cupUntil: { en: "valid until {d}", pt: "vale até {d}", es: "válido hasta {d}", hi: "{d} तक मान्य" },
  cupManualAsk: { en: "No automatic value — how much does it take off this bill?", pt: "Sem valor automático — quanto ele desconta nesta conta?", es: "Sin valor automático — ¿cuánto descuenta en esta cuenta?", hi: "कोई स्वचालित मूल्य नहीं — इस बिल पर कितनी छूट?" },
  cupMaxHint: { en: "up to {v}", pt: "até {v}", es: "hasta {v}", hi: "{v} तक" },
  cupRecalc: { en: "Recalculating for the new items…", pt: "Recalculando para os itens novos…", es: "Recalculando para los artículos nuevos…", hi: "नए आइटम के लिए फिर से गिन रहे हैं…" },
  cupPending: { en: "Apply or clear the coupon code before charging.", pt: "Aplique ou apague o código do cupom antes de cobrar.", es: "Aplica o borra el código del cupón antes de cobrar.", hi: "चार्ज से पहले कूपन लागू करें या हटाएँ।" },
  cupFix: { en: "Fix or remove the coupon before charging.", pt: "Corrija ou tire o cupom antes de cobrar.", es: "Corrige o quita el cupón antes de cobrar.", hi: "चार्ज से पहले कूपन ठीक करें या हटाएँ।" },
  cupExpiredOn: { en: "This coupon expired on {d}.", pt: "Este cupom venceu em {d}.", es: "Este cupón venció el {d}.", hi: "यह कूपन {d} को समाप्त हुआ।" },
  cupStartsOn: { en: "This coupon starts on {d}.", pt: "Este cupom começa a valer em {d}.", es: "Este cupón empieza a valer el {d}.", hi: "यह कूपन {d} से मान्य है।" },
  cupLimit: { en: "This coupon has reached its limit of {n} uses.", pt: "Este cupom já atingiu o limite de {n} usos.", es: "Este cupón ya llegó a su límite de {n} usos.", hi: "यह कूपन {n} उपयोग की सीमा तक पहुँच गया।" },
  cupLimit1: { en: "This coupon could be used only once, and it already was.", pt: "Este cupom só podia ser usado uma vez, e já foi.", es: "Este cupón solo se podía usar una vez, y ya se usó.", hi: "यह कूपन केवल एक बार इस्तेमाल हो सकता था, और हो चुका है।" },
  cupMax: { en: "The most it can take off is {v}.", pt: "O máximo é {v}.", es: "El máximo es {v}.", hi: "अधिकतम {v}।" },
  cupApplied: { en: "Coupon", pt: "Cupom", es: "Cupón", hi: "कूपन" },
  // pagamento
  payments: { en: "Payment", pt: "Pagamento", es: "Pago", hi: "भुगतान" },
  m_cash: { en: "Cash", pt: "Dinheiro", es: "Efectivo", hi: "नकद" },
  m_card: { en: "Card (terminal)", pt: "Cartão (maquininha)", es: "Tarjeta (terminal)", hi: "कार्ड (टर्मिनल)" },
  m_gift_card: { en: "Gift card", pt: "Vale-presente", es: "Tarjeta regalo", hi: "गिफ्ट कार्ड" },
  m_package: { en: "Package session", pt: "Sessão do pacote", es: "Sesión del paquete", hi: "पैकेज सत्र" },
  m_other: { en: "Other", pt: "Outro", es: "Otro", hi: "अन्य" },
  autoRest: { en: "takes the rest", pt: "fica com o restante", es: "toma el resto", hi: "बाकी लेता है" },
  received: { en: "Received", pt: "Recebido", es: "Recibido", hi: "मिला" },
  change: { en: "Change due", pt: "Troco", es: "Cambio", hi: "लौटाने हैं" },
  short: { en: "Short by", pt: "Faltam", es: "Faltan", hi: "कम हैं" },
  code: { en: "Gift card code", pt: "Código do vale", es: "Código de la tarjeta", hi: "गिफ्ट कार्ड कोड" },
  fill: { en: "Fill the rest", pt: "Completar", es: "Completar", hi: "बाकी भरें" },
  remaining: { en: "Remaining", pt: "Falta", es: "Falta", hi: "बाकी" },
  over: { en: "Over by", pt: "Passou", es: "Sobra", hi: "ज़्यादा" },
  settled: { en: "Covered", pt: "Fechado", es: "Cubierto", hi: "पूरा" },
  // recibo e cobrar
  receipt: { en: "Receipt", pt: "Recibo", es: "Recibo", hi: "रसीद" },
  emailReceipt: { en: "Email the receipt", pt: "Enviar recibo por e-mail", es: "Enviar recibo por correo", hi: "ईमेल से रसीद भेजें" },
  receiptEmail: { en: "Email", pt: "E-mail", es: "Correo", hi: "ईमेल" },
  badEmail: { en: "Check the email for the receipt.", pt: "Confira o e-mail do recibo.", es: "Revisa el correo del recibo.", hi: "रसीद का ईमेल जाँचें।" },
  charge: { en: "Charge", pt: "Cobrar", es: "Cobrar", hi: "चार्ज करें" },
  sending: { en: "Charging…", pt: "Cobrando…", es: "Cobrando…", hi: "चार्ज हो रहा है…" },
  needCode: { en: "Type the gift card code.", pt: "Digite o código do vale.", es: "Escribe el código de la tarjeta.", hi: "गिफ्ट कार्ड कोड लिखें।" },
  needCustom: { en: "Give the custom item a name and an amount.", pt: "Dê nome e valor ao item avulso.", es: "Ponle nombre y monto al artículo libre.", hi: "अन्य आइटम का नाम और राशि लिखें।" },
  needItems: { en: "Add at least one item.", pt: "Adicione pelo menos um item.", es: "Agrega al menos un artículo.", hi: "कम से कम एक आइटम जोड़ें।" },
  needSettle: { en: "Payments must match the total exactly.", pt: "Os pagamentos têm de fechar exatamente com o total.", es: "Los pagos deben sumar exactamente el total.", hi: "भुगतान ठीक कुल के बराबर होने चाहिए।" },
  // sucesso
  done: { en: "Sale complete", pt: "Venda fechada", es: "Venta cerrada", hi: "बिक्री पूरी" },
  saleNo: { en: "Sale", pt: "Venda", es: "Venta", hi: "बिक्री" },
  dupe: { en: "This sale had already been recorded — nothing was charged twice.", pt: "Esta venda já estava registrada — nada foi cobrado duas vezes.", es: "Esta venta ya estaba registrada — no se cobró dos veces.", hi: "यह बिक्री पहले से दर्ज थी — दो बार चार्ज नहीं हुआ।" },
  giftCreated: { en: "Gift card code — give it to the client", pt: "Código do vale — entregue à cliente", es: "Código de la tarjeta — entrégalo a la clienta", hi: "गिफ्ट कार्ड कोड — ग्राहक को दें" },
  copy: { en: "Copy", pt: "Copiar", es: "Copiar", hi: "कॉपी करें" },
  copied: { en: "Copied", pt: "Copiado", es: "Copiado", hi: "कॉपी हुआ" },
  receiptSent: { en: "Receipt sent to", pt: "Recibo enviado para", es: "Recibo enviado a", hi: "रसीद भेजी गई" },
  receiptNot: { en: "The receipt was NOT sent. You can resend it from the sale.", pt: "O recibo NÃO foi enviado. Dá para reenviar pela venda.", es: "El recibo NO se envió. Puedes reenviarlo desde la venta.", hi: "रसीद नहीं भेजी गई। बिक्री से फिर भेज सकते हैं।" },
  noReceipt: { en: "No receipt requested.", pt: "Sem recibo por e-mail.", es: "Sin recibo por correo.", hi: "रसीद नहीं माँगी गई।" },
  newSale: { en: "New sale", pt: "Nova venda", es: "Nueva venta", hi: "नई बिक्री" },
  close: { en: "Close", pt: "Fechar", es: "Cerrar", hi: "बंद करें" },
};
const t = (k) => tx(T[k]) || k;

// ── amostra (só fora de conta conectada) ─────────────────────────────────────────────────────
const CATALOGO_AMOSTRA = {
  ok: true,
  products: [
    { id: "PR1", name: "Hydrating Serum", brand: "Natura", price_cents: 4800, stock: 6 },
    { id: "PR2", name: "Cuticle Oil", brand: "", price_cents: 1800, stock: null },
    { id: "PR3", name: "Body Lotion", brand: "Natura", price_cents: 3200, stock: 0 },
  ],
  packages: [{ id: "PK1", name: "5 × Deep Tissue", service: "Deep Tissue 60min", sessions: 5, price_cents: 60000 }],
};
const CLIENTES_AMOSTRA = [
  { contact_key: "maria@example.com", name: "Maria S.", contact: "maria@example.com" },
  { contact_key: "17185550142", name: "Jenny K.", contact: "+1 718 555 0142" },
  { contact_key: "olivia@example.com", name: "Olivia R.", contact: "olivia@example.com" },
];
const fichaAmostra = (contato) => {
  const c = String(contato || "").toLowerCase();
  const dias = (n) => new Date(Date.now() + n * 86400000).toISOString();
  if (c.includes("maria")) return { ok: true, profile: { name: "Maria S.", allergies: "Nut oils", alerts: "Prefers light pressure" },
    packages: [{ id: "PP1", name: "5 × Deep Tissue", left: 3, total: 5, status: "active", expires_at: dias(40) }, { id: "PP2", name: "3 × Facial", left: 1, total: 3, status: "expired", expires_at: dias(-5) }],
    gift_cards: [{ code: "SAMPLE25", balance_cents: 2500, amount_cents: 5000, active: true }] };
  return { ok: true, profile: null, packages: [], gift_cards: [] };
};

// Cupons da amostra (sem conexão): a mesma resposta do desk_coupon_check, com a mesma régua.
const CUPONS_AMOSTRA = {
  WELCOME10: { code: "WELCOME10", kind: "pct", tipo: "percent", value: 10, label: "10% off your first visit", redeemed: 12, max_redemptions: 100, dias: 30 },
  SAVE25: { code: "SAVE25", kind: "amount", tipo: "amount", value: 25, label: "$25 off", redeemed: 4, max_redemptions: null, dias: 14 },
  B1G1: { code: "B1G1", kind: "bogo", tipo: "manual", value: null, label: "Buy 1, get 1 free", redeemed: 7, max_redemptions: null, dias: null },
  SUMMER15: { code: "SUMMER15", kind: "pct", tipo: "percent", value: 15, label: "Summer 15%", redeemed: 40, max_redemptions: null, dias: -20 },
};
/** Mesma régua do banco (_desk_cupom_valor): % arredondado, valor fixo em moeda, nunca passa da base; manual = null. */
const valorCupom = (c, base) => (c.tipo === "percent" ? Math.min(Math.round(base * Math.min(Math.max(Number(c.value) || 0, 0), 100) / 100), base)
  : c.tipo === "amount" ? Math.min(Math.round(Math.max(Number(c.value) || 0, 0) * 100), base) : null);
const conferirAmostra = (code, base) => {
  const a = CUPONS_AMOSTRA[String(code || "").trim().toUpperCase()];
  if (!a) return { ok: false, reason: "coupon_not_found" };
  const coupon = { ...a, expires_at: a.dias == null ? null : new Date(Date.now() + a.dias * 86400000).toISOString() };
  if (a.dias != null && a.dias < 0) return { ok: false, reason: "coupon_expired", detail: coupon.expires_at, coupon };
  const desc = valorCupom(coupon, base);
  if (desc != null && desc <= 0) return { ok: false, reason: "coupon_no_base", coupon, base_cents: base };
  return { ok: true, coupon, base_cents: base, discount_cents: desc, automatic: desc != null };
};

// cupom na tela: fase '' (nada) | 'conferindo' | 'ok' | 'erro'; d = resposta do coupon_check; base = a base que ele conferiu
const CUPOM_VAZIO = { txt: "", fase: "", d: null, base: 0, valorTxt: "" };

// ── utilidades ───────────────────────────────────────────────────────────────────────────────
let _n = 0;
const chave = () => `k${Date.now().toString(36)}${(_n++).toString(36)}`;
const novoPedido = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`);
/** centavos → texto de campo editável ("140.50"); a tela mostra dinheiro sempre por dinheiro(). */
const paraCampo = (cents) => (Math.max(Number(cents) || 0, 0) / 100).toFixed(2);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const contatoValido = (c) => EMAIL.test(String(c || "").trim()) || String(c || "").replace(/\D/g, "").length >= 7;
const pct = (txt) => { const n = parseFloat(String(txt ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 0; };
const ehStaff = (p) => !p.kind || p.kind === "staff";

const totalLinha = (l) => {
  const unit = l.editavel ? (centavos(l.unitTxt) || 0) : (Number(l.unit) || 0);
  const desc = centavos(l.descTxt) || 0;
  return Math.max(unit * (l.qty || 1) - desc, 0);
};

export default function DeskCaixa({ email, dataKey, conectado, agenda, loc, appointment = null, onClose, onDone }) {
  const tz = loc?.tz || "America/New_York";
  const services = useMemo(() => agenda?.services || [], [agenda]);
  const pros = useMemo(() => (agenda?.pros || []).filter((p) => ehStaff(p) && (!loc || !(p.locations || []).length || p.locations.includes(loc.id))), [agenda, loc]);
  const nomePro = useCallback((id) => (agenda?.pros || []).find((p) => p.id === id)?.name || "—", [agenda]);
  const proPara = useCallback((svcId) => (pros.find((p) => !(p.services || []).length || p.services.includes(svcId)) || pros[0] || null)?.id || "", [pros]);

  // ── estado da venda ────────────────────────────────────────────────────────────────────
  const linhaServico = useCallback((svc, proId) => ({
    key: chave(), kind: "service", ref_id: svc.id, name: svc.name, unit: Number(svc.price_cents) || 0,
    editavel: !(Number(svc.price_cents) > 0), unitTxt: "", qty: 1, descTxt: "", pro_id: proId || proPara(svc.id),
  }), [proPara]);

  const inicial = useCallback(() => {
    const contato = appointment?.customer_contact || "";
    const svc = appointment ? services.find((s) => s.id === appointment.service_id) : null;
    // ADICIONAIS (desk_v11): cada adicional do agendamento vira uma linha de serviço própria (preço do cadastro de hoje).
    const extras = svc ? (appointment.addons || []).map((ad) => services.find((s) => s.id === ad.service_id)).filter(Boolean).map((s) => linhaServico(s, appointment.pro_id)) : [];
    return {
      nome: appointment?.customer_name || "", contato,
      linhas: svc ? [linhaServico(svc, appointment.pro_id), ...extras] : [],
      descModo: "amt", descTxt: "", impostoTxt: "",
      gorjeta: "none", gorjetaTxt: "", gorjetaPara: "",
      pagamentos: [{ key: chave(), method: "card", txt: "", auto: true, ref: "", recebidoTxt: "" }],
      recibo: EMAIL.test(contato.trim()), reciboPara: EMAIL.test(contato.trim()) ? contato.trim() : "",
    };
  }, [appointment, services, linhaServico]);

  const [v, setV] = useState(inicial);
  const [appt, setAppt] = useState(appointment);   // "Nova venda" solta o agendamento: a 2ª venda é avulsa
  const up = (patch) => setV((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  const pedido = useRef(novoPedido());
  const [enviando, setEnviando] = useState(false);
  const travado = useRef(false);
  const [resultado, setResultado] = useState(null);
  const avisado = useRef(false);
  const [cupom, setCupom] = useState(CUPOM_VAZIO);

  // ── catálogo (uma vez) ─────────────────────────────────────────────────────────────────
  const [cat, setCat] = useState(() => (conectado ? { fase: "lendo", products: [], packages: [] } : { fase: "ok", ...CATALOGO_AMOSTRA }));
  const [catSeq, setCatSeq] = useState(0);
  useEffect(() => {
    if (!conectado) return undefined;
    let vivo = true;
    setCat((c) => ({ ...c, fase: "lendo" }));
    chamarDesk(email, dataKey, { action: "catalog" }).then(({ d }) => {
      if (!vivo) return;
      if (d?.ok) setCat({ fase: "ok", products: d.products || [], packages: d.packages || [] });
      else setCat((c) => ({ ...c, fase: "falhou" }));
    });
    return () => { vivo = false; };
  }, [conectado, email, dataKey, catSeq]);

  // ── busca de cliente (300ms) ───────────────────────────────────────────────────────────
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState({ fase: "", lista: [] });
  useEffect(() => {
    const q = busca.trim();
    const pronta = q.replace(/\D/g, "").length >= 3 || q.replace(/[^\p{L}]/gu, "").length >= 2;
    if (!pronta) { setAchados({ fase: "", lista: [] }); return undefined; }
    let vivo = true;
    const id = setTimeout(async () => {
      if (!conectado) {
        const ql = q.toLowerCase();
        setAchados({ fase: "ok", lista: CLIENTES_AMOSTRA.filter((c) => `${c.name} ${c.contact}`.toLowerCase().includes(ql) || (ql.replace(/\D/g, "") && c.contact.replace(/\D/g, "").includes(ql.replace(/\D/g, "")))) });
        return;
      }
      setAchados((a) => ({ ...a, fase: "lendo" }));
      const { d } = await chamarDesk(email, dataKey, { action: "client_search", q });
      if (!vivo) return;
      const lista = Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : Array.isArray(d?.clients) ? d.clients : null;
      setAchados(lista ? { fase: "ok", lista } : { fase: "falhou", lista: [] });
    }, 300);
    return () => { vivo = false; clearTimeout(id); };
  }, [busca, conectado, email, dataKey]);

  const escolherCliente = (c) => {
    const contato = c.contact || "";
    up((s) => ({ nome: c.name || s.nome, contato, ...(EMAIL.test(contato) ? { recibo: true, reciboPara: contato } : {}) }));
    setBusca(""); setAchados({ fase: "", lista: [] });
  };

  // ── ficha da cliente (pacotes, vales, alergias) ────────────────────────────────────────
  const [ficha, setFicha] = useState({ fase: "", d: null });
  useEffect(() => {
    const c = v.contato.trim();
    if (!contatoValido(c)) { setFicha({ fase: "", d: null }); return undefined; }
    let vivo = true;
    const id = setTimeout(async () => {
      if (!conectado) { setFicha({ fase: "ok", d: fichaAmostra(c) }); return; }
      setFicha((f) => ({ ...f, fase: "lendo" }));
      const { d } = await chamarDesk(email, dataKey, { action: "client_card", contact: c });
      if (!vivo) return;
      setFicha(d?.ok ? { fase: "ok", d } : { fase: "falhou", d: null });
    }, 500);
    return () => { vivo = false; clearTimeout(id); };
  }, [v.contato, conectado, email, dataKey]);
  // nome vazio + ficha com nome = completa (nunca sobrescreve o que a recepção digitou)
  const nomeFicha = ficha.d?.profile?.name || ficha.d?.crm?.name || "";
  useEffect(() => { if (nomeFicha) setV((s) => (s.nome.trim() ? s : { ...s, nome: nomeFicha })); }, [nomeFicha]);

  // ── contas ─────────────────────────────────────────────────────────────────────────────
  const linhaPorKey = (k) => v.linhas.find((l) => l.key === k);
  const subtotal = v.linhas.reduce((s, l) => s + totalLinha(l), 0);
  const servicosSub = v.linhas.filter((l) => l.kind === "service").reduce((s, l) => s + totalLinha(l), 0);
  const desconto = Math.min(v.descModo === "pct" ? Math.round(subtotal * pct(v.descTxt) / 100) : (centavos(v.descTxt) || 0), subtotal);
  // CUPOM (desk_v14): a base do cupom não inclui vale-presente (crédito da loja nunca leva desconto) — a mesma do banco.
  const baseCupom = v.linhas.filter((l) => l.kind !== "giftcard").reduce((s, l) => s + totalLinha(l), 0);
  const cupomOk = cupom.fase === "ok" && cupom.d?.ok ? cupom.d : null;
  const cupomManual = !!cupomOk && !cupomOk.automatic;
  const cupomVelho = !!cupomOk && cupomOk.automatic && cupom.base !== baseCupom;   // os itens mudaram: espera a nova conta do servidor
  const descCupom = !cupomOk ? 0 : cupomManual ? (centavos(cupom.valorTxt) || 0) : cupomVelho ? 0 : Number(cupomOk.discount_cents) || 0;
  // com cupom sem valor automático, o desconto digitado no cupom É o desconto da venda (o banco trata assim)
  const descontoTotal = cupomManual ? descCupom : desconto + descCupom;
  const base = Math.max(subtotal - descontoTotal, 0);
  const imposto = Math.round(base * pct(v.impostoTxt) / 100);
  const gorjeta = v.gorjeta === "none" ? 0 : v.gorjeta === "custom" ? (centavos(v.gorjetaTxt) || 0) : Math.round(servicosSub * Number(v.gorjeta) / 100);
  const total = base + imposto + gorjeta;

  // profissionais dos serviços → quem recebe a gorjeta
  const prosGorjeta = [...new Set(v.linhas.filter((l) => l.kind === "service" && l.pro_id).map((l) => l.pro_id))];
  const destino = prosGorjeta.length <= 1 ? (prosGorjeta[0] || "") : (v.gorjetaPara === "split" || !prosGorjeta.includes(v.gorjetaPara) ? "split" : v.gorjetaPara);
  const linhasGorjeta = (() => {
    if (gorjeta <= 0) return [];
    if (destino !== "split") return [{ kind: "tip", unit_cents: gorjeta, ...(destino ? { pro_id: destino } : {}) }];
    const parte = Math.floor(gorjeta / prosGorjeta.length); let sobra = gorjeta - parte * prosGorjeta.length;
    return prosGorjeta.map((id) => { const c = parte + (sobra > 0 ? 1 : 0); if (sobra > 0) sobra -= 1; return { kind: "tip", unit_cents: c, pro_id: id }; }).filter((x) => x.unit_cents > 0);
  })();

  const valorPag = (p, todos) => {
    if (p.method === "package") { const l = linhaPorKey(p.lineKey); return l ? totalLinha(l) : 0; }
    if (p.auto) { const outros = todos.filter((x) => x.key !== p.key).reduce((s, x) => s + valorPag(x, todos), 0); return Math.max(total - outros, 0); }
    return centavos(p.txt) || 0;
  };
  const pagos = v.pagamentos.map((p) => ({ ...p, valor: valorPag(p, v.pagamentos) }));
  const pago = pagos.reduce((s, p) => s + p.valor, 0);
  const falta = total - pago;

  // ── cupom: o servidor confere e dá o número exato; itens mudaram = reconfere sozinho ───────
  // `quieto`: reconferência — o cartão do cupom fica na tela dizendo "recalculando" em vez de piscar.
  const conferirCupom = async (code, baseAgora, { quieto = false, valorTxt = "" } = {}) => {
    const c = String(code || "").trim().toUpperCase();
    if (!c) return;
    setCupom((s) => ({ ...s, txt: c, ...(quieto ? {} : { fase: "conferindo" }) }));
    const d = conectado ? (await chamarDesk(email, dataKey, { action: "coupon_check", code: c, subtotal_cents: baseAgora })).d : conferirAmostra(c, baseAgora);
    setCupom((s) => (s.txt !== c ? s : { ...s, fase: d?.ok ? "ok" : "erro", d: d || { ok: false }, base: baseAgora,
      valorTxt: d?.ok && !d.automatic ? (s.valorTxt || valorTxt) : s.valorTxt }));
    if (d?.ok && !d.automatic && !quieto) up({ descTxt: "" });
  };
  const aplicarCupom = () => {
    // cupom sem valor automático herda o desconto que já estava digitado (e o campo geral some: vira o do cupom)
    const herdado = desconto > 0 ? paraCampo(desconto) : "";
    conferirCupom(cupom.txt, baseCupom, { valorTxt: herdado });
  };
  const tirarCupom = () => setCupom(CUPOM_VAZIO);
  useEffect(() => {
    if (!cupomVelho) return undefined;
    const id = setTimeout(() => conferirCupom(cupom.txt, baseCupom, { quieto: true }), 400);
    return () => clearTimeout(id);
  }, [cupomVelho, baseCupom]); // eslint-disable-line react-hooks/exhaustive-deps
  // texto do erro do cupom: a frase do motivo, com a data / o limite / o máximo quando o banco manda
  const erroCupom = (d) => {
    if (!d) return "";
    const dia = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? quando(`${iso}T12:00:00Z`, "UTC", { day: "numeric", month: "short", year: "numeric" }) : quando(iso, tz, { day: "numeric", month: "short", year: "numeric" }));
    if (d.reason === "coupon_expired" && (d.coupon?.expires_at || d.detail)) return t("cupExpiredOn").replace("{d}", dia(d.coupon?.expires_at || d.detail));
    if (d.reason === "coupon_not_started" && (d.coupon?.starts_at || d.detail)) return t("cupStartsOn").replace("{d}", dia(d.coupon?.starts_at || d.detail));
    if (d.reason === "coupon_exhausted" && (d.coupon?.max_redemptions || d.detail)) { const n = Number(d.coupon?.max_redemptions || d.detail); return n === 1 ? t("cupLimit1") : t("cupLimit").replace("{n}", n); }
    if (d.reason === "discount_over_base" && Number.isFinite(Number(d.detail))) return `${motivo(d)} ${t("cupMax").replace("{v}", dinheiro(Number(d.detail), tz))}`;
    return motivo(d);
  };

  // ── validação antes de cobrar ──────────────────────────────────────────────────────────
  const problema = (() => {
    if (!v.linhas.length) return t("needItems");
    if (v.linhas.some((l) => l.kind === "giftcard" && (centavos(l.unitTxt) || 0) < 100)) return motivo({ reason: "giftcard_amount" });
    if (v.linhas.some((l) => l.kind === "custom" && (!l.name.trim() || !(centavos(l.unitTxt) > 0)))) return t("needCustom");
    if ((v.linhas.some((l) => l.kind === "package") || pagos.some((p) => p.method === "package")) && !v.contato.trim()) return motivo({ reason: "package_needs_contact" });
    if (pagos.some((p) => p.method === "gift_card" && p.valor > 0 && !p.ref.trim())) return t("needCode");
    if (cupom.fase === "conferindo" || cupomVelho) return t("checking");
    if (cupom.txt.trim() && !cupomOk) return cupom.fase === "erro" ? t("cupFix") : t("cupPending");
    if (cupomManual && descCupom <= 0) return motivo({ reason: "coupon_needs_amount" });
    if (cupomOk && descontoTotal > baseCupom) return `${motivo({ reason: "discount_over_base" })} ${t("cupMax").replace("{v}", dinheiro(cupomManual ? baseCupom : Math.max(baseCupom - descCupom, 0), tz))}`;
    if (falta !== 0) return t("needSettle");
    if (v.recibo && !EMAIL.test(v.reciboPara.trim())) return t("badEmail");
    return "";
  })();

  // ── itens ──────────────────────────────────────────────────────────────────────────────
  const setLinha = (k, patch) => up((s) => ({ linhas: s.linhas.map((l) => (l.key === k ? { ...l, ...patch } : l)) }));
  const tirarLinha = (k) => up((s) => ({ linhas: s.linhas.filter((l) => l.key !== k), pagamentos: s.pagamentos.filter((p) => p.lineKey !== k) }));
  const addServico = (id) => { const s = services.find((x) => x.id === id); if (s) up((st) => ({ linhas: [...st.linhas, linhaServico(s)] })); };
  const addProduto = (id) => {
    const p = (cat.products || []).find((x) => x.id === id); if (!p) return;
    if (p.stock != null && p.stock <= 0) { toast(`${motivo({ reason: "out_of_stock" })} ${p.name}`); return; }
    up((st) => {
      const ja = st.linhas.find((l) => l.kind === "product" && l.ref_id === p.id);
      if (ja) return { linhas: st.linhas.map((l) => (l.key === ja.key ? { ...l, qty: p.stock != null ? Math.min(l.qty + 1, p.stock) : l.qty + 1 } : l)) };
      return { linhas: [...st.linhas, { key: chave(), kind: "product", ref_id: p.id, name: p.name, brand: p.brand, unit: Number(p.price_cents) || 0, stock: p.stock, qty: 1, descTxt: "", pro_id: "" }] };
    });
  };
  const addPacote = (id) => { const p = (cat.packages || []).find((x) => x.id === id); if (p) up((st) => ({ linhas: [...st.linhas, { key: chave(), kind: "package", ref_id: p.id, name: p.name, sessions: p.sessions, unit: Number(p.price_cents) || 0, qty: 1, descTxt: "" }] })); };
  const addVale = () => up((st) => ({ linhas: [...st.linhas, { key: chave(), kind: "giftcard", name: "", editavel: true, unitTxt: "", recipient: "", qty: 1, descTxt: "" }] }));
  const addAvulso = () => up((st) => ({ linhas: [...st.linhas, { key: chave(), kind: "custom", name: "", editavel: true, unitTxt: "", qty: 1, descTxt: "" }] }));

  // ── pagamentos ─────────────────────────────────────────────────────────────────────────
  const setPag = (k, patch) => up((s) => ({ pagamentos: s.pagamentos.map((p) => (p.key === k ? { ...p, ...patch } : p)) }));
  const tirarPag = (k) => up((s) => ({ pagamentos: s.pagamentos.filter((p) => p.key !== k) }));
  const addPag = (method, extra = {}) => up((s) => ({ pagamentos: [...s.pagamentos, { key: chave(), method, txt: "", auto: false, ref: "", recebidoTxt: "", ...extra }] }));
  // desk_v13: quantas sessões de pacote um serviço debita (config.pkg_sessions, padrão 1)
  const nSessoes = (svcId) => Math.max(1, Number(services.find((s) => s.id === svcId)?.pkg_sessions) || 1);
  const usarSessao = (pk) => {
    if (pk.status === "expired") { toast(motivo({ reason: "package_expired" })); return; }
    const cobertas = new Set(v.pagamentos.filter((p) => p.method === "package").map((p) => p.lineKey));
    const usadas = v.pagamentos.filter((p) => p.method === "package" && p.ref === pk.id).reduce((acc, p) => acc + nSessoes(linhaPorKey(p.lineKey)?.ref_id), 0);
    const resta = (Number(pk.left) || 0) - usadas;
    if (resta <= 0) { toast(t("pkgNoMore")); return; }
    const linha = v.linhas.find((l) => l.kind === "service" && !cobertas.has(l.key));
    if (!linha) { toast(t("needServiceForPkg")); return; }
    const n = nSessoes(linha.ref_id);
    if (resta < n) { toast(t("pkgShortMsg").replace("{pkg}", pk.name).replace("{left}", resta).replace("{svc}", linha.name).replace("{n}", n)); return; }
    addPag("package", { ref: pk.id, lineKey: linha.key, pkgName: pk.name });
  };
  const usarVale = (g) => {
    const ja = v.pagamentos.find((p) => p.method === "gift_card" && p.ref.toUpperCase() === String(g.code).toUpperCase());
    if (ja) return;
    addPag("gift_card", { ref: g.code, txt: paraCampo(Math.min(Number(g.balance_cents) || 0, Math.max(falta, 0))) });
  };

  // ── cobrar ─────────────────────────────────────────────────────────────────────────────
  const corpoVenda = () => {
    const lines = v.linhas.map((l) => {
      const desc = centavos(l.descTxt) || 0;
      const base0 = { kind: l.kind, qty: l.qty || 1, ...(desc > 0 ? { discount_cents: desc } : {}) };
      if (l.kind === "service") return { ...base0, ref_id: l.ref_id, ...(l.pro_id ? { pro_id: l.pro_id } : {}), ...(l.editavel ? { unit_cents: centavos(l.unitTxt) || 0 } : {}) };
      if (l.kind === "product") return { ...base0, ref_id: l.ref_id, ...(l.pro_id ? { pro_id: l.pro_id } : {}) };
      if (l.kind === "package") return { ...base0, ref_id: l.ref_id };
      if (l.kind === "giftcard") return { ...base0, qty: 1, unit_cents: centavos(l.unitTxt) || 0, ...(l.recipient?.trim() ? { recipient: l.recipient.trim() } : {}) };
      return { ...base0, qty: 1, name: l.name.trim(), unit_cents: centavos(l.unitTxt) || 0 };
    }).concat(linhasGorjeta);
    // pacote: ref = compra; service_id = o serviço pago, para o motor debitar as sessões daquele serviço (desk_v13)
    const payments = pagos.filter((p) => p.valor > 0).map((p) => ({ method: p.method, amount_cents: p.valor,
      ...(p.method === "gift_card" ? { ref: p.ref.trim().toUpperCase() } : {}),
      ...(p.method === "package" ? { ref: p.ref, ...(linhaPorKey(p.lineKey)?.ref_id ? { service_id: linhaPorKey(p.lineKey).ref_id } : {}) } : {}) }));
    return {
      ...(appt?.id ? { appointment_id: appt.id } : {}),
      ...(loc?.id ? { location_id: loc.id } : {}),
      customer_name: v.nome.trim(), customer_contact: v.contato.trim(),
      // com cupom sem valor automático, o desconto digitado no cupom vai como desconto da venda (o banco o conta como do cupom)
      discount_cents: cupomManual ? descCupom : desconto, tax_cents: imposto,
      ...(cupomOk ? { coupon_code: cupomOk.coupon?.code || cupom.txt } : {}),
      ...(v.recibo && EMAIL.test(v.reciboPara.trim()) ? { receipt_to: v.reciboPara.trim() } : {}),
      request_id: pedido.current, lines, payments,
    };
  };

  const cobrar = async () => {
    if (problema) { toast(problema); return; }
    if (!conectado) { toast(t("sampleToast")); return; }
    if (travado.current) return;
    travado.current = true; setEnviando(true);
    const sale = corpoVenda();
    const { http, d } = await chamarDesk(email, dataKey, { action: "checkout", sale });
    let final = null;
    if (d?.ok === true && d.idempotent && d.sale_id) {
      // a venda já existia (repetição): lê o que ficou gravado para mostrar número, total e códigos.
      const r = await chamarDesk(email, dataKey, { action: "sale", id: d.sale_id });
      const s = r.d?.ok ? r.d : null;
      final = { ok: true, idempotent: true, sale_id: d.sale_id, number: s?.sale?.number || "", total_cents: s?.sale?.total_cents ?? total,
        ...(s?.sale?.coupon_code ? { coupon: { code: s.sale.coupon_code, discount_cents: Number(s.sale.coupon_discount_cents) || 0 } } : {}),
        lines: (s?.lines || []).map((l) => ({ kind: l.kind, name: l.name, total_cents: l.total_cents, ...(l.meta?.code ? { code: l.meta.code } : {}) })) };
    } else if (d?.ok === true) {
      final = d;
    }
    travado.current = false; setEnviando(false);
    if (final) { avisado.current = false; setResultado({ ...final, _receipt_to: sale.receipt_to || "" }); return; }
    if (/^coupon_|^discount_over_base$/.test(String(d?.reason || "")) && cupom.txt) setCupom((s) => ({ ...s, fase: "erro", d }));
    let msg = /^coupon_|^discount_over_base$/.test(String(d?.reason || "")) ? erroCupom(d) : motivo(d, http);
    if (d?.reason === "out_of_stock" && d.detail) msg = `${msg} ${d.detail}`;
    if (d?.reason === "giftcard_balance" && d.detail != null && Number.isFinite(Number(d.detail))) msg = `${msg} (${dinheiro(Number(d.detail), tz)})`;
    if (d?.reason === "package_expired" && d.detail) msg = `${msg} (${d.detail})`;
    if (d?.reason === "package_short" && /^\d+\/\d+$/.test(String(d.detail || ""))) { const [r, n] = String(d.detail).split("/"); msg = `${msg} ${t("pkgShortDetail").replace("{left}", r).replace("{n}", n)}`; }
    toast(msg);
  };

  const avisar = () => { if (resultado && !avisado.current) { avisado.current = true; onDone?.(resultado); } };
  const fechar = () => { avisar(); onClose?.(); };
  const novaVenda = () => {
    avisar();
    pedido.current = novoPedido();
    setAppt(null);
    setResultado(null); setBusca(""); setFicha({ fase: "", d: null }); setCupom(CUPOM_VAZIO);
    setV({ nome: "", contato: "", linhas: [], descModo: "amt", descTxt: "", impostoTxt: "", gorjeta: "none", gorjetaTxt: "", gorjetaPara: "",
      pagamentos: [{ key: chave(), method: "card", txt: "", auto: true, ref: "", recebidoTxt: "" }], recibo: false, reciboPara: "" });
  };

  // ── visual ─────────────────────────────────────────────────────────────────────────────
  const campo = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-g-word placeholder:text-g-muted [color-scheme:dark]";
  const mini = "rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-sm text-g-word placeholder:text-g-muted num [color-scheme:dark]";
  const rot = "text-[10px] uppercase tracking-wide text-g-muted";
  const chip = (ativo) => `rounded-full px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold border ${ativo ? "border-g-green/50 bg-g-green/20 text-g-word" : "border-white/10 bg-white/[0.04] text-g-muted hover:text-g-word"}`;
  const secao = "rounded-xl2 border border-white/10 bg-white/[0.03] p-3 space-y-2.5";

  // ── tela de sucesso ────────────────────────────────────────────────────────────────────
  if (resultado) {
    const codigos = (resultado.lines || []).filter((l) => l.code);
    const pediuRecibo = !!resultado._receipt_to;
    const copiar = async (c) => { try { await navigator.clipboard.writeText(c); toast(t("copied")); } catch { toast(c); } };
    return (
      <Drawer title={t("done")} subtitle={resultado.number ? `${t("saleNo")} #${resultado.number}` : ""} onClose={fechar}
        actions={<>
          <button onClick={novaVenda} className="flex-1 min-h-[44px] rounded-full border border-white/15 px-4 py-2.5 text-sm font-bold text-g-word">{t("newSale")}</button>
          <button onClick={fechar} className="flex-1 min-h-[44px] rounded-full bg-g-green px-4 py-2.5 text-sm font-extrabold text-[#161512]">{t("close")}</button>
        </>}>
        <div className="space-y-4 pt-1">
          <div className="rounded-xl2 border border-g-green/30 bg-g-green/[0.07] p-4 text-center">
            <div className="text-3xl" aria-hidden>✓</div>
            <div className={`${rot} mt-1`}>{t("total")}</div>
            <div className="text-3xl font-black num text-g-green">{dinheiro(resultado.total_cents, tz)}</div>
            {resultado.number && <div className="text-xs text-g-muted mt-1 num">{t("saleNo")} #{resultado.number}</div>}
            {resultado.coupon?.code && <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-g-green/30 px-3 py-1 text-xs font-bold text-g-word num">
              <span aria-hidden>🏷</span>{t("cupApplied")} <span className="tracking-wider">{resultado.coupon.code}</span> · −{dinheiro(resultado.coupon.discount_cents, tz)}</div>}
          </div>
          {resultado.idempotent && <div className="rounded-xl2 border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-g-muted">{t("dupe")}</div>}
          {codigos.map((l) => (
            <div key={l.code} className="rounded-xl2 border border-g-gold/40 bg-g-gold/[0.08] p-4">
              <div className={rot}>{t("giftCreated")}</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="text-2xl font-black tracking-[0.2em] text-g-word num select-all break-all">{l.code}</div>
                <button onClick={() => copiar(l.code)} className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word">{t("copy")}</button>
              </div>
              <div className="text-xs text-g-muted mt-1 num">{dinheiro(l.total_cents, tz)}</div>
            </div>
          ))}
          <div className={`rounded-xl2 border px-3 py-2.5 text-xs ${!pediuRecibo ? "border-white/10 bg-white/[0.04] text-g-muted" : resultado.recibo?.ok ? "border-g-green/30 bg-g-green/[0.06] text-g-word" : "border-red-400/30 bg-red-400/[0.06] text-red-300"}`} role={pediuRecibo && !resultado.recibo?.ok ? "alert" : undefined}>
            {!pediuRecibo ? t("noReceipt") : resultado.recibo?.ok ? `${t("receiptSent")} ${resultado._receipt_to}` : t("receiptNot")}
          </div>
        </div>
      </Drawer>
    );
  }

  // ── a venda ────────────────────────────────────────────────────────────────────────────
  const alergias = ficha.d?.profile?.allergies;
  const alertas = ficha.d?.profile?.alerts;
  // com sessões sobrando — o vencido também aparece (apagado), para a recepção saber por que não dá para usar
  const pacotesCliente = (ficha.d?.packages || []).filter((p) => (Number(p.left) || 0) > 0);
  const valesCliente = (ficha.d?.gift_cards || []).filter((g) => g.active !== false && (Number(g.balance_cents) || 0) > 0);
  const temAuto = v.pagamentos.some((p) => p.auto);

  return (
    <Drawer title={t("title")} subtitle={appt ? `${t("fromAppt")} · ${appt.customer_name || ""}` : `${t("walkin")}${loc?.name ? ` · ${loc.name}` : ""}`} onClose={onClose}>
      <div className="space-y-3">
        {!conectado && <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] px-3 py-2 text-xs text-g-light">{t("sample")}</div>}
        {appt?.sale_id && <div className="rounded-xl2 border border-yellow-300/30 bg-yellow-300/[0.06] px-3 py-2 text-xs text-yellow-100">{t("already")}</div>}

        {/* ── cliente ── */}
        <section className={secao}>
          <div className="text-xs font-extrabold text-g-word">{t("client")}</div>
          <div className="relative">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("find")} className={campo} aria-label={t("find")} />
            {achados.fase && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-white/15 bg-[#1f1d19] shadow-2xl overflow-hidden">
                {achados.fase === "lendo" && <div className="px-3 py-2 text-xs text-g-muted">{t("searching")}</div>}
                {achados.fase === "falhou" && <div className="px-3 py-2 text-xs text-red-300">{t("searchFail")}</div>}
                {achados.fase === "ok" && !achados.lista.length && <div className="px-3 py-2 text-xs text-g-muted">{t("noMatch")}</div>}
                {achados.fase === "ok" && achados.lista.slice(0, 8).map((c) => (
                  <button key={c.contact_key || c.contact} type="button" onClick={() => escolherCliente(c)} className="block w-full text-left px-3 py-2.5 hover:bg-white/[0.06] border-t border-white/[0.06] first:border-t-0">
                    <div className="text-sm font-bold text-g-word truncate">{c.name || "—"}</div>
                    <div className="text-[11px] text-g-muted truncate">{c.contact}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2">
            <label className={rot}>{t("name")}<input value={v.nome} onChange={(e) => up({ nome: e.target.value })} className={`${campo} mt-1 normal-case tracking-normal`} /></label>
            <label className={rot}>{t("contact")}<input value={v.contato} onChange={(e) => { const c = e.target.value; up((s) => ({ contato: c, ...(EMAIL.test(c.trim()) && (!s.reciboPara || s.reciboPara === s.contato.trim()) ? { reciboPara: c.trim(), recibo: true } : {}) })); }} className={`${campo} mt-1 normal-case tracking-normal`} inputMode="email" /></label>
          </div>
          {ficha.fase === "lendo" && <div className="text-[11px] text-g-muted">{t("cardLoading")}</div>}
          {ficha.fase === "falhou" && <div className="text-[11px] text-red-300">{t("cardFail")}</div>}
          {(alergias || alertas) && (
            <div role="alert" className="rounded-xl border border-amber-400/50 bg-amber-400/[0.12] px-3 py-2 text-xs text-amber-100 space-y-0.5">
              {alergias && <div><span className="font-black uppercase text-amber-300">⚠ {t("allergies")}:</span> {alergias}</div>}
              {alertas && <div><span className="font-black uppercase text-amber-300">{t("alerts")}:</span> {alertas}</div>}
            </div>
          )}
          {pacotesCliente.length > 0 && (
            <div className="space-y-1.5">
              <div className={rot}>{t("packages")}</div>
              {pacotesCliente.map((p) => {
                const vencido = p.status === "expired";
                return (
                  <div key={p.id} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${vencido ? "border-red-300/25 bg-white/[0.02]" : "border-white/10 bg-white/[0.04]"}`}>
                    <div className="min-w-0">
                      <div className={`text-sm font-bold truncate ${vencido ? "text-g-muted" : "text-g-word"}`}>{p.name}</div>
                      <div className="text-[11px] text-g-muted num">
                        {p.left}/{p.total} {t("left")}
                        {p.expires_at ? <span className={vencido ? "text-red-300" : ""}> · {t(vencido ? "expiredOn" : "expiresOn")} {quando(p.expires_at, tz, { day: "numeric", month: "short" })}</span> : null}
                        {p.status === "not_activated" ? ` · ${t("notActivated")}` : ""}
                      </div>
                    </div>
                    {vencido
                      ? <span className="shrink-0 rounded-full border border-red-300/30 px-3 py-1.5 text-xs font-bold text-red-300">{t("expiredBadge")}</span>
                      : <button type="button" onClick={() => usarSessao(p)} className="shrink-0 rounded-full border border-g-green/40 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-green">{t("useSession")}</button>}
                  </div>
                );
              })}
            </div>
          )}
          {valesCliente.length > 0 && (
            <div className="space-y-1.5">
              <div className={rot}>{t("giftCards")}</div>
              {valesCliente.map((g) => (
                <div key={g.code} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <div className="min-w-0"><div className="text-sm font-bold text-g-word num tracking-wider">{g.code}</div><div className="text-[11px] text-g-muted num">{dinheiro(g.balance_cents, tz)}</div></div>
                  <button type="button" onClick={() => usarVale(g)} className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word">{t("useGift")}</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── cobrar online no Stripe DO NEGÓCIO: cartão salvo, taxa de falta, assinatura (2026-10-05) ── */}
        {/* Recepção (código próprio) não cobra no Stripe do negócio: essa rota só aceita a chave da dona. */}
        {!ehRecepcao(dataKey) && <DeskPagamentosOnline email={email} dataKey={dataKey} conectado={conectado} tz={tz} contato={v.contato} nome={v.nome} appt={appt}
          feeCents={Number(services.find((x) => x.id === appt?.service_id)?.noshow_fee_cents) || 0} />}

        {/* ── itens ── */}
        <section className={secao}>
          <div className="text-xs font-extrabold text-g-word">{t("items")}</div>
          {v.linhas.length === 0 && <div className="text-xs text-g-muted">{t("empty")}</div>}
          {v.linhas.map((l) => (
            <Linha key={l.key} l={l} tz={tz} pros={pros} nomePro={nomePro} setLinha={setLinha} tirar={tirarLinha} campo={campo} mini={mini} rot={rot} />
          ))}

          <div className="grid grid-cols-1 gap-2 pt-1">
            <select value="" onChange={(e) => e.target.value && addServico(e.target.value)} className={campo} aria-label={t("k_service")}>
              <option value="">+ {t("k_service")} — {t("pickService")}</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}{s.duration_min ? ` · ${s.duration_min}m` : ""} · {Number(s.price_cents) > 0 ? dinheiro(s.price_cents, tz) : t("onRequestShort")}</option>)}
            </select>
            {cat.fase === "lendo" && <SectionSkeleton rows={2} />}
            {cat.fase === "falhou" && (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-xs text-red-300">
                <span>{t("catalogFail")}</span>
                <button type="button" onClick={() => setCatSeq((n) => n + 1)} className="font-bold text-g-word underline">{t("retry")}</button>
              </div>
            )}
            {cat.fase === "ok" && (
              <>
                {(cat.products || []).length ? (
                  <select value="" onChange={(e) => e.target.value && addProduto(e.target.value)} className={campo} aria-label={t("k_product")}>
                    <option value="">+ {t("k_product")} — {t("pickProduct")}</option>
                    {cat.products.map((p) => <option key={p.id} value={p.id} disabled={p.stock != null && p.stock <= 0}>{p.name}{p.brand ? ` (${p.brand})` : ""} · {dinheiro(p.price_cents, tz)}{p.stock == null ? "" : p.stock > 0 ? ` · ${p.stock} ${t("inStock")}` : ` · ${t("outStock")}`}</option>)}
                  </select>
                ) : <div className="text-[11px] text-g-muted">{t("noProducts")}</div>}
                {(cat.packages || []).length ? (
                  <select value="" onChange={(e) => e.target.value && addPacote(e.target.value)} className={campo} aria-label={t("k_package")}>
                    <option value="">+ {t("k_package")} — {t("pickPackage")}</option>
                    {cat.packages.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sessions} {t("sessions")} · {dinheiro(p.price_cents, tz)}</option>)}
                  </select>
                ) : <div className="text-[11px] text-g-muted">{t("noPackages")}</div>}
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={addVale} className={chip(false)}>+ {t("k_giftcard")}</button>
              <button type="button" onClick={addAvulso} className={chip(false)}>+ {t("k_custom")}</button>
            </div>
          </div>
        </section>

        {/* ── gorjeta ── */}
        <section className={secao}>
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-xs font-extrabold text-g-word">{t("tip")}</div>
            <div className="text-[11px] text-g-muted num">{dinheiro(gorjeta, tz)}{servicosSub > 0 ? ` · ${t("tipBase")} ${dinheiro(servicosSub, tz)}` : ""}</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[["15", "15%"], ["18", "18%"], ["20", "20%"], ["custom", t("customTip")], ["none", t("noTip")]].map(([k, lab]) => (
              <button key={k} type="button" onClick={() => up({ gorjeta: k })} className={chip(v.gorjeta === k)}>
                {lab}{["15", "18", "20"].includes(k) && servicosSub > 0 ? <span className="ml-1 font-normal opacity-70 num">{dinheiro(Math.round(servicosSub * Number(k) / 100), tz)}</span> : null}
              </button>
            ))}
          </div>
          {v.gorjeta === "custom" && <input value={v.gorjetaTxt} onChange={(e) => up({ gorjetaTxt: e.target.value })} inputMode="decimal" placeholder={t("amount")} className={campo} aria-label={t("tip")} autoFocus />}
          {gorjeta > 0 && prosGorjeta.length === 1 && <div className="text-[11px] text-g-muted">{t("tipTo")}: <span className="text-g-word font-bold">{nomePro(prosGorjeta[0])}</span></div>}
          {gorjeta > 0 && prosGorjeta.length > 1 && (
            <div className="space-y-1">
              <div className={rot}>{t("tipTo")}</div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => up({ gorjetaPara: "split" })} className={chip(destino === "split")}>{t("split")}</button>
                {prosGorjeta.map((id) => <button key={id} type="button" onClick={() => up({ gorjetaPara: id })} className={chip(destino === id)}>{nomePro(id)}</button>)}
              </div>
              {destino === "split" && <div className="text-[11px] text-g-muted num">{linhasGorjeta.map((x) => `${nomePro(x.pro_id)} ${dinheiro(x.unit_cents, tz)}`).join(" · ")}</div>}
            </div>
          )}
        </section>

        {/* ── totais ── */}
        <section className={secao}>
          <div className="flex justify-between text-sm"><span className="text-g-muted">{t("subtotal")}</span><span className="font-bold text-g-word num">{dinheiro(subtotal, tz)}</span></div>
          <CupomCaixa cupom={cupom} setCupom={setCupom} cupomOk={cupomOk} cupomManual={cupomManual} cupomVelho={cupomVelho} descCupom={descCupom}
            baseCupom={baseCupom} aplicar={aplicarCupom} tirar={tirarCupom} erroCupom={erroCupom} tz={tz} mini={mini} />
          {!cupomManual && <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-g-muted">{t("discount")}</span>
            <div className="flex items-center gap-1.5">
              <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5">
                {[["amt", t("amount")], ["pct", "%"]].map(([k, lab]) => <button key={k} type="button" onClick={() => up({ descModo: k })} className={`px-2.5 py-0.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] rounded-full text-[11px] font-bold ${v.descModo === k ? "bg-g-green/20 text-g-word" : "text-g-muted"}`}>{lab}</button>)}
              </div>
              <input value={v.descTxt} onChange={(e) => up({ descTxt: e.target.value })} inputMode="decimal" placeholder="0" className={`${mini} w-20 text-right`} aria-label={t("discount")} />
            </div>
          </div>}
          {!cupomManual && desconto > 0 && <div className="flex justify-end text-xs text-g-muted num">−{dinheiro(desconto, tz)}</div>}
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-g-muted">{t("tax")}</span>
            <div className="flex items-center gap-2">
              {imposto > 0 && <span className="text-xs text-g-muted num">{dinheiro(imposto, tz)}</span>}
              <input value={v.impostoTxt} onChange={(e) => up({ impostoTxt: e.target.value })} inputMode="decimal" placeholder="0" className={`${mini} w-20 text-right`} aria-label={t("tax")} />
            </div>
          </div>
          <div className="flex justify-between text-sm"><span className="text-g-muted">{t("tip")}</span><span className="font-bold text-g-word num">{dinheiro(gorjeta, tz)}</span></div>
          <div className="flex items-end justify-between border-t border-white/10 pt-2.5">
            <span className="text-sm font-extrabold text-g-word uppercase tracking-wide">{t("total")}</span>
            <span className="text-3xl font-black text-g-green num">{dinheiro(total, tz)}</span>
          </div>
        </section>

        {/* ── pagamento ── */}
        <section className={secao}>
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-xs font-extrabold text-g-word">{t("payments")}</div>
            <div className={`text-xs font-black num ${falta === 0 ? "text-g-green" : falta > 0 ? "text-yellow-200" : "text-red-300"}`}>
              {falta === 0 ? `✓ ${t("settled")}` : falta > 0 ? `${t("remaining")} ${dinheiro(falta, tz)}` : `${t("over")} ${dinheiro(-falta, tz)}`}
            </div>
          </div>
          {pagos.map((p) => {
            const recebido = centavos(p.recebidoTxt);
            const linhaPkg = p.method === "package" ? linhaPorKey(p.lineKey) : null;
            return (
              <div key={p.key} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-g-word">{t(`m_${p.method}`)}</span>
                  <div className="flex items-center gap-2">
                    {p.method === "package" || p.auto
                      ? <span className="text-sm font-extrabold text-g-word num">{dinheiro(p.valor, tz)}</span>
                      : <input value={p.txt} onChange={(e) => setPag(p.key, { txt: e.target.value })} inputMode="decimal" placeholder={paraCampo(Math.max(falta, 0))} className={`${mini} w-24 text-right`} aria-label={`${t(`m_${p.method}`)} ${t("amount")}`} />}
                    {(pagos.length > 1 || p.method !== "card") && <button type="button" onClick={() => tirarPag(p.key)} aria-label={t("remove")} className="grid place-items-center min-w-[40px] min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-g-muted hover:text-red-300 px-1">✕</button>}
                  </div>
                </div>
                {p.auto && (
                  <div className="flex items-center justify-between text-[11px] text-g-muted">
                    <span>{t("autoRest")}</span>
                    <button type="button" onClick={() => setPag(p.key, { auto: false, txt: paraCampo(p.valor) })} className="underline py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px]">{t("amount")}</button>
                  </div>
                )}
                {!p.auto && p.method !== "package" && falta !== 0 && (
                  <button type="button" onClick={() => setPag(p.key, { txt: paraCampo(Math.max(p.valor + falta, 0)) })} className="text-[11px] font-bold text-g-green underline py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px]">{t("fill")}</button>
                )}
                {p.method === "package" && <div className="text-[11px] text-g-muted">{p.pkgName || ""}{linhaPkg ? ` → ${linhaPkg.name}${nSessoes(linhaPkg.ref_id) > 1 ? ` · ${nSessoes(linhaPkg.ref_id)} ${t("sessions")}` : ""}` : ""}</div>}
                {p.method === "gift_card" && <input value={p.ref} onChange={(e) => setPag(p.key, { ref: e.target.value.toUpperCase() })} placeholder={t("code")} className={`${mini} w-full tracking-widest uppercase`} aria-label={t("code")} />}
                {p.method === "cash" && (
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-[11px] text-g-muted">{t("received")}
                      <input value={p.recebidoTxt} onChange={(e) => setPag(p.key, { recebidoTxt: e.target.value })} inputMode="decimal" placeholder={paraCampo(p.valor)} className={`${mini} w-24 text-right`} />
                    </label>
                    {recebido != null && (recebido >= p.valor
                      ? <span className="text-sm font-black text-g-green num">{t("change")} {dinheiro(recebido - p.valor, tz)}</span>
                      : <span className="text-xs font-bold text-red-300 num">{t("short")} {dinheiro(p.valor - recebido, tz)}</span>)}
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-1.5">
            {["cash", "card", "gift_card", "other"].map((m) => (
              <button key={m} type="button" onClick={() => addPag(m, !temAuto ? { txt: paraCampo(Math.max(falta, 0)) } : {})} className={chip(false)}>+ {t(`m_${m}`)}</button>
            ))}
          </div>
        </section>

        {/* ── recibo ── */}
        <section className={secao}>
          <label className="flex items-center gap-2 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-sm text-g-word">
            <input type="checkbox" checked={v.recibo} onChange={(e) => up({ recibo: e.target.checked })} className="h-4 w-4 accent-[#2FE39A]" />
            {t("emailReceipt")}
          </label>
          {v.recibo && <input value={v.reciboPara} onChange={(e) => up({ reciboPara: e.target.value })} type="email" inputMode="email" placeholder={t("receiptEmail")} className={campo} aria-label={t("receiptEmail")} />}
        </section>
      </div>
      {/* pé fixo: total e Cobrar sempre ao alcance do polegar, em qualquer ponto da rolagem */}
      <div className="sticky bottom-0 z-20 -mx-5 -mb-5 mt-3 border-t border-white/10 bg-g-cream/95 backdrop-blur-xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        {problema && v.linhas.length > 0 && <div className="text-[11px] text-g-muted text-center">{problema}</div>}
        <button onClick={cobrar} disabled={enviando || !!problema}
          className="w-full min-h-[48px] rounded-full bg-g-green px-4 py-3 text-base font-extrabold text-[#161512] disabled:opacity-40 num">
          {enviando ? t("sending") : `${t("charge")} ${dinheiro(total, tz)}`}
        </button>
      </div>
    </Drawer>
  );
}

// O cupom nos totais (desk_v14). Três jeitos: campo + Aplicar · cartão verde do cupom aplicado (com o número que o
// servidor deu, a regra, usos e validade) · erro em vermelho dentro do próprio campo (toast some; o erro fica).
function CupomCaixa({ cupom, setCupom, cupomOk, cupomManual, cupomVelho, descCupom, baseCupom, aplicar, tirar, erroCupom, tz, mini }) {
  const c = cupomOk?.coupon;
  if (c) {
    const fixo = Math.round((Number(c.value) || 0) * 100);
    const regra = c.tipo === "percent" ? t("cupPct").replace("{v}", Number(c.value) || 0).replace("{base}", dinheiro(cupom.base, tz))
      : c.tipo === "amount" ? t(fixo > cupom.base ? "cupCapped" : "cupAmt").replace("{v}", dinheiro(fixo, tz)) : "";
    const usos = c.max_redemptions ? t("cupUses").replace("{n}", c.redeemed || 0).replace("{max}", c.max_redemptions) : t("cupUsesFree").replace("{n}", c.redeemed || 0);
    const ate = c.expires_at ? t("cupUntil").replace("{d}", quando(c.expires_at, tz, { day: "numeric", month: "short" })) : "";
    return (
      <div className="rounded-xl border border-g-green/30 bg-g-green/[0.06] p-2.5 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-g-muted">{t("coupon")}</div>
            <div className="text-sm font-black tracking-wider text-g-word num truncate"><span aria-hidden className="mr-1.5">🏷</span>{c.code}</div>
            {c.label && <div className="text-[11px] text-g-word/80 truncate">{c.label}</div>}
            <div className="text-[11px] text-g-muted num">{[regra, usos, ate].filter(Boolean).join(" · ")}</div>
            {c.terms && <div className="text-[11px] text-g-muted italic line-clamp-2">{c.terms}</div>}
          </div>
          <div className="text-right shrink-0">
            <div className={`text-sm font-extrabold num ${cupomVelho ? "text-g-muted" : "text-g-green"}`}>{cupomVelho ? "…" : descCupom > 0 ? `−${dinheiro(descCupom, tz)}` : "—"}</div>
            <button type="button" onClick={tirar} className="py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-[11px] text-g-muted hover:text-red-300">{t("remove")}</button>
          </div>
        </div>
        {cupomVelho && <div className="text-[11px] text-yellow-200" role="status">{t("cupRecalc")}</div>}
        {cupomManual && (
          <label className="block text-[11px] text-yellow-200">{t("cupManualAsk")}
            <span className="mt-1 flex items-center gap-2">
              <input value={cupom.valorTxt} onChange={(e) => setCupom((s) => ({ ...s, valorTxt: e.target.value }))} inputMode="decimal" placeholder={t("amount")}
                className={`${mini} w-28 text-right`} aria-label={`${t("coupon")} ${c.code} — ${t("amount")}`} autoFocus />
              <span className="text-g-muted num">{t("cupMaxHint").replace("{v}", dinheiro(baseCupom, tz))}</span>
            </span>
          </label>
        )}
      </div>
    );
  }
  const errou = cupom.fase === "erro";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-g-muted shrink-0">{t("coupon")}</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <input value={cupom.txt} onChange={(e) => setCupom({ ...CUPOM_VAZIO, txt: e.target.value.toUpperCase().replace(/\s+/g, "") })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (cupom.txt.trim()) aplicar(); } }}
            placeholder={t("couponPh")} className={`${mini} w-36 sm:w-40 tracking-widest uppercase ${errou ? "border-red-400/60" : ""}`}
            aria-label={t("couponPh")} aria-invalid={errou} aria-describedby={errou ? "cupom-erro" : undefined} autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={40} />
          <button type="button" onClick={aplicar} disabled={!cupom.txt.trim() || cupom.fase === "conferindo"}
            className="shrink-0 rounded-full border border-g-green/40 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-green disabled:opacity-40">
            {cupom.fase === "conferindo" ? t("checking") : t("apply")}
          </button>
        </div>
      </div>
      {errou && (
        <div id="cupom-erro" role="alert" className="flex items-start justify-between gap-2 rounded-xl border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-xs text-red-300">
          <span>{erroCupom(cupom.d)}</span>
          <button type="button" onClick={tirar} className="shrink-0 font-bold text-g-word underline">{t("remove")}</button>
        </div>
      )}
    </div>
  );
}

// Uma linha do carrinho. Preço do cadastro é só leitura; editável só onde o servidor aceita.
function Linha({ l, tz, pros, nomePro, setLinha, tirar, campo, mini, rot }) {
  const [comDesc, setComDesc] = useState(!!l.descTxt);
  const tot = totalLinha(l);
  const unit = l.editavel ? (centavos(l.unitTxt) || 0) : (Number(l.unit) || 0);
  const maxQtd = l.kind === "product" && l.stock != null ? l.stock : 99;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={rot}>{t(`k_${l.kind}`)}</div>
          {l.kind === "custom"
            ? <input value={l.name} onChange={(e) => setLinha(l.key, { name: e.target.value })} placeholder={t("customName")} className={`${campo} mt-1`} />
            : <div className="text-sm font-bold text-g-word truncate">{l.kind === "giftcard" ? t("k_giftcard") : l.name}{l.brand ? <span className="font-normal text-g-muted"> · {l.brand}</span> : null}</div>}
          {l.kind === "package" && l.sessions ? <div className="text-[11px] text-g-muted">{l.sessions} {t("sessions")}</div> : null}
          {l.kind === "product" && l.stock != null && <div className="text-[11px] text-g-muted num">{l.stock} {t("inStock")}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-extrabold text-g-word num">{dinheiro(tot, tz)}</div>
          <button type="button" onClick={() => tirar(l.key)} className="py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-[11px] text-g-muted hover:text-red-300">{t("remove")}</button>
        </div>
      </div>

      {l.kind === "service" && l.editavel && (
        <label className="block text-[11px] text-yellow-200">{t("onRequest")}
          <input value={l.unitTxt} onChange={(e) => setLinha(l.key, { unitTxt: e.target.value })} inputMode="decimal" placeholder={t("price")} className={`${campo} mt-1`} />
        </label>
      )}
      {(l.kind === "giftcard" || l.kind === "custom") && (
        <label className="block text-[11px] text-g-muted">{l.kind === "giftcard" ? t("giftAmount") : t("amount")}
          <input value={l.unitTxt} onChange={(e) => setLinha(l.key, { unitTxt: e.target.value })} inputMode="decimal" placeholder={l.kind === "giftcard" ? `${t("giftMin")} ${dinheiro(100, tz)}` : t("amount")} className={`${campo} mt-1`} />
        </label>
      )}
      {l.kind === "giftcard" && (
        <>
          <input value={l.recipient || ""} onChange={(e) => setLinha(l.key, { recipient: e.target.value })} placeholder={t("recipient")} className={campo} aria-label={t("recipient")} />
          <div className="text-[11px] text-g-muted">{t("codeLater")}</div>
        </>
      )}

      {(l.kind === "service" || l.kind === "product") && pros.length > 0 && (
        <label className="flex items-center justify-between gap-2 text-[11px] text-g-muted">{l.kind === "service" ? t("pro") : t("soldBy")}
          <select value={l.pro_id || ""} onChange={(e) => setLinha(l.key, { pro_id: e.target.value })} className={`${mini} max-w-[60%]`}>
            {l.kind === "product" && <option value="">{t("nobody")}</option>}
            {l.kind === "service" && l.pro_id && !pros.some((p) => p.id === l.pro_id) && <option value={l.pro_id}>{nomePro(l.pro_id)}</option>}
            {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}

      <div className="flex items-center justify-between gap-2">
        {l.kind === "product" ? (
          <div className="flex items-center gap-1" role="group" aria-label={t("qty")}>
            <button type="button" onClick={() => setLinha(l.key, { qty: Math.max(1, l.qty - 1) })} disabled={l.qty <= 1} className="h-10 w-10 lg:h-7 lg:w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 rounded-full border border-white/15 text-g-word disabled:opacity-30">−</button>
            <span className="w-7 text-center text-sm font-bold text-g-word num">{l.qty}</span>
            <button type="button" onClick={() => setLinha(l.key, { qty: Math.min(maxQtd, l.qty + 1) })} disabled={l.qty >= maxQtd} className="h-10 w-10 lg:h-7 lg:w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 rounded-full border border-white/15 text-g-word disabled:opacity-30">+</button>
            <span className="ml-1 text-[11px] text-g-muted num">× {dinheiro(unit, tz)}</span>
          </div>
        ) : <span className="text-[11px] text-g-muted num">{l.kind === "giftcard" || l.kind === "custom" || l.editavel ? "" : dinheiro(unit, tz)}</span>}
        {l.kind !== "giftcard" && (comDesc ? (
          <label className="flex items-center gap-1.5 text-[11px] text-g-muted">{t("lineDisc")}
            <input value={l.descTxt} onChange={(e) => setLinha(l.key, { descTxt: e.target.value })} inputMode="decimal" placeholder="0" className={`${mini} w-20 text-right`} autoFocus />
          </label>
        ) : <button type="button" onClick={() => setComDesc(true)} className="py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-[11px] text-g-muted underline">{t("addDisc")}</button>)}
      </div>
    </div>
  );
}
