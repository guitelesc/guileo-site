// ONE source of truth for the client-activation step-by-step. Used by:
//   • /vendedor (seller hub → Ativação tab)   • /go-live (client-facing guide)   • /admin (owner tracking)
// Keep it neutral/imperative so it reads fine for both the client and the operator. Trilingual.

export const pickL = (o, lang) => (o ? (o[lang] || o.en || o.pt || "") : "");

export const ACTIVATION_STEPS = [
  {
    icon: "💳",
    title: { pt: "Pagamento", en: "Payment", es: "Pago" },
    body: {
      pt: "Pague o plano (ou o link de pagamento). A Gui nasce treinada automaticamente e você recebe um email com o código de acesso. Nada manual.",
      en: "Pay the plan (or the payment link). Your Gui is born trained automatically and you get an email with the access code. Nothing manual.",
      es: "Paga el plan (o el enlace de pago). Tu Gui nace entrenada automáticamente y recibes un correo con el código de acceso. Nada manual.",
    },
  },
  {
    icon: "🔗",
    title: { pt: "Conectar o portal", en: "Connect the portal", es: "Conectar el portal" },
    body: {
      pt: "Entre em guileoai.com/portal com o MESMO email do pagamento e cole o código do email. O cockpit passa a mostrar seus dados reais.",
      en: "Sign in at guileoai.com/portal with the SAME email you paid with and paste the code from the email. The cockpit now shows your real data.",
      es: "Entra a guileoai.com/portal con el MISMO correo del pago y pega el código del correo. El cockpit muestra tus datos reales.",
    },
  },
  {
    icon: "📞",
    title: { pt: "Encaminhar a linha", en: "Forward the line", es: "Desviar la línea" },
    body: {
      pt: "No telefone do negócio, disque o código que vem no email: *72+número (todas as ligações) ou *71 (só as perdidas). Aí toda ligação cai na Gui.",
      en: "On the business phone, dial the code from the email: *72+number (all calls) or *71 (missed only). Now every call lands on Gui.",
      es: "En el teléfono del negocio, marca el código del correo: *72+número (todas) o *71 (solo perdidas). Ahora toda llamada cae en Gui.",
    },
  },
  {
    icon: "📋",
    title: { pt: "Cardápio / serviços + preços", en: "Menu / services + prices", es: "Menú / servicios + precios" },
    body: {
      pt: "Preencha serviços/cardápio com preços no /go-live ou no portal. Sem isso a Gui não tem o que agendar/cotar — e é o que ela usa pra fechar e cobrar.",
      en: "Fill in services/menu with prices in /go-live or the portal. Without it Gui has nothing to book/quote — and it's what she uses to close & collect.",
      es: "Carga servicios/menú con precios en /go-live o el portal. Sin eso Gui no tiene qué agendar/cotizar — y es lo que usa para cerrar y cobrar.",
    },
  },
  {
    icon: "💳",
    title: { pt: "Receber pagamentos (Stripe)", en: "Get paid (Stripe)", es: "Cobrar pagos (Stripe)" },
    body: {
      pt: "Pra a Gui COBRAR na ligação e o dinheiro cair na SUA conta, conecte seu Stripe uma vez em guileoai.com/receber (email + código). Sem isso a Gui agenda e atende, mas não cobra pra você.",
      en: "For the Gui to CHARGE on the call with the money landing in YOUR account, connect your Stripe once at guileoai.com/receber (email + code). Without it Gui books and answers, but won't collect for you.",
      es: "Para que la Gui COBRE en la llamada con el dinero en TU cuenta, conecta tu Stripe una vez en guileoai.com/receber (correo + código). Sin eso Gui agenda y atiende, pero no cobra para ti.",
    },
  },
  {
    icon: "✅",
    title: { pt: "Testar ao vivo", en: "Test live", es: "Probar en vivo" },
    body: {
      pt: "Ligue para o número da Gui. Confirme: ela atende, entende, agenda e manda a confirmação. Faça um agendamento/pedido de teste de ponta a ponta.",
      en: "Call the Gui number. Confirm: she answers, understands, books and sends the confirmation. Do an end-to-end test booking/order.",
      es: "Llama al número de Gui. Confirma: contesta, entiende, agenda y envía la confirmación. Haz una reserva/pedido de prueba de punta a punta.",
    },
  },
  {
    icon: "🚀",
    title: { pt: "No ar", en: "Live", es: "En vivo" },
    body: {
      pt: "Pronto! Acompanhe tudo no cockpit: ligações, agenda, pedidos e receita — em um lugar só.",
      en: "Done! Track everything in the cockpit: calls, calendar, orders and revenue — in one place.",
      es: "¡Listo! Sigue todo en el cockpit: llamadas, agenda, pedidos e ingresos — en un solo lugar.",
    },
  },
];

export const ACTIVATION_SECTORS = [
  {
    icon: "🍽️",
    name: { pt: "Restaurante — delivery", en: "Restaurant — delivery", es: "Restaurante — delivery" },
    note: {
      pt: "Abra conta num agregador (Otter recomendado), ligue Uber/DoorDash/Grubhub nele e aponte o webhook de pedido para a Guileo. Aí todo pedido cai no cockpit junto dos diretos.",
      en: "Open an aggregator account (Otter recommended), connect Uber/DoorDash/Grubhub there and point its order webhook at Guileo. Every order then lands in the cockpit next to direct ones.",
      es: "Abre cuenta en un agregador (Otter recomendado), conecta Uber/DoorDash/Grubhub ahí y apunta su webhook de pedido a Guileo. Cada pedido cae en el cockpit junto a los directos.",
    },
  },
  {
    icon: "🩺",
    name: { pt: "Clínica / Salão — depósito", en: "Clinic / Salon — deposit", es: "Clínica / Salón — depósito" },
    note: {
      pt: "Ative um depósito para segurar o horário (corta no-show). Configure o valor no portal; a Gui oferece e cobra na ligação.",
      en: "Turn on a deposit to hold the slot (cuts no-shows). Set the amount in the portal; Gui offers and collects it on the call.",
      es: "Activa un depósito para reservar el horario (corta el no-show). Configura el monto en el portal; Gui lo ofrece y cobra en la llamada.",
    },
  },
  {
    icon: "🛍️",
    name: { pt: "Outros", en: "Others", es: "Otros" },
    note: {
      pt: "Serviços + preços no portal já bastam para a Gui atender, agendar, cotar e cobrar. Refine o cérebro dela em Configurações.",
      en: "Services + prices in the portal are enough for Gui to answer, book, quote and collect. Refine her brain in Settings.",
      es: "Servicios + precios en el portal bastan para que Gui atienda, agende, cotice y cobre. Refina su cerebro en Configuración.",
    },
  },
];
