// Call Simulator scripts — short (15–20s) SCRIPTED example exchanges per vertical, en/pt/es.
// HONESTY RULE: these are simulations rendered in the browser (captions + speechSynthesis),
// never presented as recordings of real clients. The widget itself labels them "Simulação"
// and points to the real live call (#try) where Gui's actual voice does the talking.
//
// Shape: { key, icon, portalV, label:{en,pt,es,hi}, lines:{en|pt|es|hi: [{ who:"caller"|"gui", text }]} }
// `portalV` = the Growth Cockpit vertical id (src/data/verticals.js) for deep-links.

export const SIM_VERTICALS = [
  {
    key: "restaurant", icon: "🍕", portalV: "restaurant",
    label: { en: "Restaurant", pt: "Restaurante", es: "Restaurante", hi: "रेस्टोरेंट" },
    lines: {
      en: [
        { who: "caller", text: "Hi, can I order two large pepperoni pizzas for pickup?" },
        { who: "gui", text: "Absolutely! Two large pepperonis — that's $31.90. Want to add our garlic knots? They're fresh out of the oven, just $4.50." },
        { who: "caller", text: "Sure, add the garlic knots." },
        { who: "gui", text: "Perfect — $36.40 total, ready for pickup in 20 minutes. I've texted you the confirmation. See you soon!" },
      ],
      pt: [
        { who: "caller", text: "Oi, queria duas pizzas grandes de calabresa pra retirar." },
        { who: "gui", text: "Claro! Duas grandes de calabresa — dá R$ 89,90. Quer incluir o pão de alho? Saiu do forno agora, só R$ 12." },
        { who: "caller", text: "Pode incluir o pão de alho." },
        { who: "gui", text: "Perfeito — R$ 101,90 no total, pronto pra retirar em 20 minutos. Já te mandei a confirmação por mensagem. Até já!" },
      ],
      es: [
        { who: "caller", text: "Hola, quiero dos pizzas grandes de pepperoni para recoger." },
        { who: "gui", text: "¡Claro! Dos grandes de pepperoni — son $31.90. ¿Le agrego nuestro pan de ajo? Recién salido del horno, solo $4.50." },
        { who: "caller", text: "Sí, agrégame el pan de ajo." },
        { who: "gui", text: "Perfecto — $36.40 en total, listo en 20 minutos. Ya le envié la confirmación por mensaje. ¡Hasta pronto!" },
      ],
      hi: [
        { who: "caller", text: "नमस्ते, दो लार्ज पेपरोनी पिज़्ज़ा पिकअप के लिए ऑर्डर करने थे।" },
        { who: "gui", text: "बिल्कुल! दो लार्ज पेपरोनी — कुल $31.90। साथ में हमारे गार्लिक नॉट्स लेंगे? अभी-अभी ओवन से निकले हैं, सिर्फ़ $4.50।" },
        { who: "caller", text: "हाँ, गार्लिक नॉट्स भी जोड़ दीजिए।" },
        { who: "gui", text: "परफ़ेक्ट — कुल $36.40, 20 मिनट में पिकअप के लिए तैयार। कन्फ़र्मेशन मैसेज कर दिया है। जल्द मिलते हैं!" },
      ],
    },
  },
  {
    key: "clinic", icon: "🦷", portalV: "clinic",
    label: { en: "Clinic / Dental", pt: "Clínica / Odonto", es: "Clínica / Dental", hi: "क्लीनिक / डेंटल" },
    lines: {
      en: [
        { who: "caller", text: "Hi, I'd like to book a cleaning sometime this week." },
        { who: "gui", text: "Of course! Dr. Reyes has Thursday at 10am or Friday at 2:30pm. Which works better for you?" },
        { who: "caller", text: "Thursday at 10 works." },
        { who: "gui", text: "Booked — Thursday 10am. To hold the spot I'll text you a $20 deposit link; it comes off your bill. You'll also get a reminder the day before. Anything else?" },
      ],
      pt: [
        { who: "caller", text: "Oi, queria marcar uma limpeza essa semana." },
        { who: "gui", text: "Claro! A Dra. Reyes tem quinta às 10h ou sexta às 14h30. Qual fica melhor pra você?" },
        { who: "caller", text: "Quinta às 10 tá ótimo." },
        { who: "gui", text: "Agendado — quinta, 10h. Pra garantir o horário te mando um link de sinal de R$ 50, que desconta da consulta. Você recebe lembrete no dia anterior. Mais alguma coisa?" },
      ],
      es: [
        { who: "caller", text: "Hola, quiero agendar una limpieza esta semana." },
        { who: "gui", text: "¡Claro! La Dra. Reyes tiene el jueves a las 10am o el viernes a las 2:30pm. ¿Cuál le queda mejor?" },
        { who: "caller", text: "El jueves a las 10 está bien." },
        { who: "gui", text: "Agendado — jueves 10am. Para apartar el lugar le envío un enlace de depósito de $20, que se descuenta de su cuenta. Recibirá un recordatorio el día anterior. ¿Algo más?" },
      ],
      hi: [
        { who: "caller", text: "नमस्ते, इस हफ़्ते क्लीनिंग के लिए अपॉइंटमेंट लेना था।" },
        { who: "gui", text: "ज़रूर! डॉ. रेयेस के पास गुरुवार सुबह 10 बजे या शुक्रवार दोपहर 2:30 बजे का स्लॉट है। आपको कौन-सा ठीक रहेगा?" },
        { who: "caller", text: "गुरुवार 10 बजे ठीक है।" },
        { who: "gui", text: "बुक हो गया — गुरुवार सुबह 10 बजे। स्लॉट होल्ड करने के लिए $20 डिपॉज़िट का लिंक मैसेज कर रही हूँ; यह आपके बिल में से घट जाएगा। एक दिन पहले रिमाइंडर भी मिलेगा। और कुछ?" },
      ],
    },
  },
  {
    key: "salon", icon: "💇", portalV: "salon",
    label: { en: "Salon & Spa", pt: "Salão & Spa", es: "Salón & Spa", hi: "सैलून और स्पा" },
    lines: {
      en: [
        { who: "caller", text: "Hey, do you have anything for a cut and color on Saturday?" },
        { who: "gui", text: "Saturday we have 11am with Marina or 3pm with Alex. Color takes about two hours — shall I book 11 so you have your evening free?" },
        { who: "caller", text: "Yes, 11 with Marina please." },
        { who: "gui", text: "Done — Saturday 11am, cut and color with Marina. I'm texting your confirmation now, and you can reply to it anytime to reschedule." },
      ],
      pt: [
        { who: "caller", text: "Oi, tem horário pra corte e coloração no sábado?" },
        { who: "gui", text: "Sábado temos 11h com a Marina ou 15h com o Alex. Coloração leva umas duas horas — agendo às 11 pra você ficar com a noite livre?" },
        { who: "caller", text: "Sim, 11 com a Marina, por favor." },
        { who: "gui", text: "Feito — sábado 11h, corte e coloração com a Marina. Já estou te mandando a confirmação, e você pode responder a mensagem pra remarcar quando quiser." },
      ],
      es: [
        { who: "caller", text: "Hola, ¿tienen algo para corte y color el sábado?" },
        { who: "gui", text: "El sábado tenemos 11am con Marina o 3pm con Alex. El color toma unas dos horas — ¿le reservo a las 11 para que tenga la tarde libre?" },
        { who: "caller", text: "Sí, a las 11 con Marina, por favor." },
        { who: "gui", text: "Listo — sábado 11am, corte y color con Marina. Le envío la confirmación ahora, y puede responder al mensaje para reprogramar cuando quiera." },
      ],
      hi: [
        { who: "caller", text: "हैलो, शनिवार को कट और कलर के लिए कोई स्लॉट मिलेगा?" },
        { who: "gui", text: "शनिवार को मरीना के साथ सुबह 11 बजे या एलेक्स के साथ दोपहर 3 बजे खाली है। कलर में करीब दो घंटे लगते हैं — 11 बजे बुक कर दूँ ताकि आपकी शाम फ़्री रहे?" },
        { who: "caller", text: "हाँ, 11 बजे मरीना के साथ, प्लीज़।" },
        { who: "gui", text: "हो गया — शनिवार सुबह 11 बजे, मरीना के साथ कट और कलर। कन्फ़र्मेशन अभी मैसेज कर रही हूँ, और रीशेड्यूल करना हो तो उसी मैसेज का जवाब दे दीजिएगा।" },
      ],
    },
  },
  {
    key: "plumbing", icon: "🔧", portalV: "homeservices",
    label: { en: "Plumbing / HVAC", pt: "Encanador / Ar", es: "Plomería / HVAC", hi: "प्लंबिंग / HVAC" },
    lines: {
      en: [
        { who: "caller", text: "My water heater is leaking everywhere — can someone come tonight?!" },
        { who: "gui", text: "I've got you. First — is water reaching any outlets? If so, please shut off the unit's valve. A tech can be there between 7 and 8pm; after-hours visits start at $150." },
        { who: "caller", text: "Okay, valve is off. Yes, send someone." },
        { who: "gui", text: "Dispatched — Mike arrives 7–8pm and I've texted you his photo and the quote range. Hang tight, you're covered." },
      ],
      pt: [
        { who: "caller", text: "Meu aquecedor tá vazando água pra todo lado — tem como vir alguém hoje à noite?!" },
        { who: "gui", text: "Deixa comigo. Primeiro — a água está chegando perto de alguma tomada? Se sim, feche o registro do aparelho. Um técnico chega entre 19h e 20h; visita fora do horário começa em R$ 250." },
        { who: "caller", text: "Tá, fechei o registro. Pode mandar alguém." },
        { who: "gui", text: "Acionado — o Mike chega entre 19h e 20h, e já te mandei a foto dele e a faixa de orçamento por mensagem. Fica tranquilo, tá resolvido." },
      ],
      es: [
        { who: "caller", text: "¡Mi calentador está goteando por todos lados — ¿puede venir alguien esta noche?!" },
        { who: "gui", text: "Cuento con ello. Primero — ¿el agua llega a algún enchufe? Si es así, cierre la válvula del equipo. Un técnico puede llegar entre 7 y 8pm; la visita fuera de horario empieza en $150." },
        { who: "caller", text: "Listo, cerré la válvula. Sí, mande a alguien." },
        { who: "gui", text: "Enviado — Mike llega entre 7 y 8pm y ya le mandé su foto y el rango del presupuesto. Tranquilo, está resuelto." },
      ],
      hi: [
        { who: "caller", text: "मेरा वॉटर हीटर हर तरफ़ लीक कर रहा है — आज रात कोई आ सकता है क्या?!" },
        { who: "gui", text: "फ़िक्र मत कीजिए। पहले — क्या पानी किसी बिजली के सॉकेट तक पहुँच रहा है? अगर हाँ, तो यूनिट का वाल्व बंद कर दीजिए। टेक्नीशियन शाम 7 से 8 बजे के बीच पहुँच सकता है; आफ़्टर-आवर्स विज़िट $150 से शुरू होती है।" },
        { who: "caller", text: "ठीक है, वाल्व बंद कर दिया। हाँ, किसी को भेज दीजिए।" },
        { who: "gui", text: "भेज दिया — माइक 7 से 8 बजे के बीच पहुँचेगा, उसकी फ़ोटो और कोट की रेंज मैसेज कर दी है। बेफ़िक्र रहिए, काम हो जाएगा।" },
      ],
    },
  },
  {
    key: "realestate", icon: "🏠", portalV: "realestate",
    label: { en: "Real Estate", pt: "Imóveis", es: "Inmobiliaria", hi: "रियल एस्टेट" },
    lines: {
      en: [
        { who: "caller", text: "Hi, I saw the listing on Maple Street — is it still available?" },
        { who: "gui", text: "It is! Beautiful 3-bed, listed at $429k. Are you looking to buy in the next few months, and would you be financing or paying cash?" },
        { who: "caller", text: "Financing, and yes — we're hoping to move by summer." },
        { who: "gui", text: "Great fit. I can book you a showing Saturday at 1pm with our agent Dana, and text you the disclosure packet right now. Shall I lock it in?" },
      ],
      pt: [
        { who: "caller", text: "Oi, vi o anúncio da casa na Rua das Flores — ainda está disponível?" },
        { who: "gui", text: "Está sim! Linda casa de 3 quartos, por R$ 890 mil. Você pretende comprar nos próximos meses? Seria financiado ou à vista?" },
        { who: "caller", text: "Financiado, e sim — queremos mudar até o meio do ano." },
        { who: "gui", text: "Perfil perfeito. Posso agendar uma visita sábado às 13h com a corretora Dana e já te mandar a ficha do imóvel por mensagem. Confirmo?" },
      ],
      es: [
        { who: "caller", text: "Hola, vi el anuncio de la casa en la calle Maple — ¿sigue disponible?" },
        { who: "gui", text: "¡Sí! Hermosa casa de 3 habitaciones, en $429k. ¿Busca comprar en los próximos meses? ¿Sería con crédito o de contado?" },
        { who: "caller", text: "Con crédito, y sí — queremos mudarnos para el verano." },
        { who: "gui", text: "Excelente perfil. Puedo agendarle una visita el sábado a la 1pm con nuestra agente Dana y enviarle la ficha ahora mismo. ¿Lo confirmo?" },
      ],
      hi: [
        { who: "caller", text: "नमस्ते, मैंने मेपल स्ट्रीट वाली लिस्टिंग देखी — क्या वो अभी उपलब्ध है?" },
        { who: "gui", text: "जी हाँ! शानदार 3-बेडरूम, $429k में लिस्टेड। क्या आप अगले कुछ महीनों में खरीदना चाह रहे हैं — फ़ाइनैंसिंग से या कैश में?" },
        { who: "caller", text: "फ़ाइनैंसिंग से, और हाँ — गर्मियों तक शिफ़्ट होना चाहते हैं।" },
        { who: "gui", text: "बढ़िया मैच है। शनिवार दोपहर 1 बजे हमारी एजेंट डाना के साथ विज़िट बुक कर सकती हूँ, और डिस्क्लोज़र पैकेट अभी मैसेज कर देती हूँ। पक्का कर दूँ?" },
      ],
    },
  },
  {
    key: "gym", icon: "💪", portalV: "gym",
    label: { en: "Gym & Fitness", pt: "Academia", es: "Gimnasio", hi: "जिम और फ़िटनेस" },
    lines: {
      en: [
        { who: "caller", text: "Hi, how much is a membership? I've never trained before." },
        { who: "gui", text: "Welcome! Plans start at $39/mo — but first, come feel it: I can book you a free trial class. Tomorrow we have spinning at 7am or functional at 6pm." },
        { who: "caller", text: "Functional at 6 sounds good." },
        { who: "gui", text: "Booked — tomorrow 6pm, coach Leo, bring water and a towel. I've texted directions and your guest pass. See you there!" },
      ],
      pt: [
        { who: "caller", text: "Oi, quanto custa a mensalidade? Nunca treinei antes." },
        { who: "gui", text: "Bem-vindo! Os planos começam em R$ 99/mês — mas antes, vem sentir: posso agendar uma aula experimental grátis. Amanhã tem spinning às 7h ou funcional às 18h." },
        { who: "caller", text: "Funcional às 18h parece bom." },
        { who: "gui", text: "Agendado — amanhã 18h, professor Leo, traz água e toalha. Já te mandei a localização e seu passe de visitante. Te espero lá!" },
      ],
      es: [
        { who: "caller", text: "Hola, ¿cuánto cuesta la membresía? Nunca he entrenado." },
        { who: "gui", text: "¡Bienvenido! Los planes empiezan en $39/mes — pero primero venga a sentirlo: puedo agendarle una clase de prueba gratis. Mañana hay spinning a las 7am o funcional a las 6pm." },
        { who: "caller", text: "Funcional a las 6 suena bien." },
        { who: "gui", text: "Agendado — mañana 6pm, coach Leo, traiga agua y toalla. Ya le envié la ubicación y su pase de invitado. ¡Nos vemos!" },
      ],
      hi: [
        { who: "caller", text: "हैलो, मेंबरशिप कितने की है? मैंने पहले कभी ट्रेनिंग नहीं की।" },
        { who: "gui", text: "स्वागत है! प्लान $39/महीने से शुरू होते हैं — पर पहले आकर महसूस कीजिए: मैं एक फ़्री ट्रायल क्लास बुक कर सकती हूँ। कल सुबह 7 बजे स्पिनिंग है या शाम 6 बजे फ़ंक्शनल।" },
        { who: "caller", text: "शाम 6 बजे फ़ंक्शनल ठीक रहेगा।" },
        { who: "gui", text: "बुक हो गया — कल शाम 6 बजे, कोच लियो, पानी और तौलिया साथ लाइएगा। लोकेशन और आपका गेस्ट पास मैसेज कर दिया है। वहीं मिलते हैं!" },
      ],
    },
  },
];
