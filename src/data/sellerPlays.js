// Jogadas diárias — 30 real, specific sales plays for Guileo sellers, surfaced in the "Jogadas do
// dia" tab of /vendedor. Not generic advice: each is a concrete move a seller runs in the field —
// where to stand, when to show up, exactly what to say, which channel converts. The mix is
// deliberate: US moves (walk-in the restaurant at 2:30pm dead-hour, show the missed-calls
// calculator on the spot) and BR moves (40s WhatsApp voice note — audio converts ~3x text here,
// neighborhood Facebook/WhatsApp groups). SellerIdeas.jsx picks a "Jogada do dia" deterministically
// from the date so it's the same all day and rotates on its own tomorrow.
//
// Shape (one play): {
//   id       — stable slug
//   icon     — one emoji
//   title    — { pt, en, es }  (hi inherits en at render)
//   how      — { pt:[3-4 steps], en:[...], es:[...] }  concrete, do-this-now steps
//   where    — 'us' | 'br' | 'both'   which market it fits
//   channel  — 'porta' | 'telefone' | 'whatsapp' | 'instagram' | 'email' | 'evento'
// }
// title/how carry pt/en/es; Hindi falls back to en in the component (micro-dict law).

export const SELLER_PLAYS = [
  {
    id: "lunch-dead-hour",
    icon: "🍽️",
    where: "us",
    channel: "porta",
    title: {
      pt: "A jogada do almoço morto",
      en: "The dead-hour lunch play",
      es: "La jugada de la hora muerta",
    },
    how: {
      pt: [
        "Chegue no restaurante às 14h30, quando o movimento cai e o dono respira.",
        "Peça pra falar com o dono — nunca com o garçom. \"Só 2 minutos, é sobre as ligações que vocês perdem no horário de pico.\"",
        "Abra a calculadora de ligações perdidas no celular e faça a conta AO VIVO com o número dele.",
        "Feche com: \"Deixa a Gui te ligar agora pra você ouvir a voz.\" — a demo fecha sozinha.",
      ],
      en: [
        "Walk in at 2:30pm, when the rush is over and the owner can breathe.",
        "Ask for the owner — never the server. \"Just 2 minutes, it's about the calls you miss during the rush.\"",
        "Open the missed-calls calculator on your phone and run the math LIVE with his own number.",
        "Close with: \"Let Gui call you right now so you hear the voice.\" — the demo closes itself.",
      ],
      es: [
        "Llega a las 2:30pm, cuando pasó el pico y el dueño puede respirar.",
        "Pide hablar con el dueño — nunca con el mesero. \"Solo 2 minutos, es sobre las llamadas que pierden en la hora pico.\"",
        "Abre la calculadora de llamadas perdidas en el celular y haz la cuenta EN VIVO con su número.",
        "Cierra con: \"Deja que Gui te llame ahora para que escuches la voz.\" — la demo cierra sola.",
      ],
    },
  },
  {
    id: "whatsapp-audio-40s",
    icon: "🎙️",
    where: "br",
    channel: "whatsapp",
    title: {
      pt: "Áudio de 40 segundos (converte 3x mais)",
      en: "The 40-second voice note (converts 3x)",
      es: "El audio de 40 segundos (convierte 3x)",
    },
    how: {
      pt: [
        "Pro dono que você conheceu, mande um áudio de WhatsApp — não texto. Áudio converte ~3x mais no Brasil.",
        "Fale o nome dele nos primeiros 3 segundos: \"Oi Marcelo, aqui é o {seller}, lembra de mim?\"",
        "Uma frase de dor + uma de ganho: \"Quantas ligações você perde depois das 18h? A Gui atende todas, no nome do seu negócio.\"",
        "Termine com pergunta fechada: \"Posso te ligar 5 minutos amanhã de manhã?\"",
      ],
      en: [
        "For the owner you just met, send a WhatsApp voice note — not text. Audio converts ~3x more in Brazil.",
        "Say his name in the first 3 seconds: \"Hi Marcelo, it's {seller}, remember me?\"",
        "One line of pain + one of gain: \"How many calls do you lose after 6pm? Gui answers them all, in your business's name.\"",
        "End with a closed question: \"Can I call you for 5 minutes tomorrow morning?\"",
      ],
      es: [
        "Al dueño que conociste, mándale un audio de WhatsApp — no texto. El audio convierte ~3x más.",
        "Di su nombre en los primeros 3 segundos: \"Hola Marcelo, soy {seller}, ¿te acuerdas de mí?\"",
        "Una frase de dolor + una de ganancia: \"¿Cuántas llamadas pierdes después de las 18h? Gui las contesta todas, con el nombre de tu negocio.\"",
        "Cierra con pregunta cerrada: \"¿Te puedo llamar 5 minutos mañana en la mañana?\"",
      ],
    },
  },
  {
    id: "call-your-own-target",
    icon: "📞",
    where: "both",
    channel: "telefone",
    title: {
      pt: "Ligue pro alvo fora do horário",
      en: "Call your target after hours",
      es: "Llama al objetivo fuera de horario",
    },
    how: {
      pt: [
        "Antes de abordar, LIGUE pro negócio às 20h ou no domingo. Ninguém atende? Achou a dor.",
        "Grave ou anote: \"Liguei quinta 20h05, caiu na caixa postal.\" — prova concreta.",
        "Na abordagem, comece por isso: \"Liguei ontem às 20h e ninguém atendeu. Sabe quantos clientes fazem isso e não voltam?\"",
        "Ofereça a Gui como quem tampa exatamente esse buraco — não como \"mais uma ferramenta\".",
      ],
      en: [
        "Before you approach, CALL the business at 8pm or on a Sunday. Nobody answers? You found the pain.",
        "Record or note it: \"Called Thursday 8:05pm, went to voicemail.\" — concrete proof.",
        "Open the pitch with it: \"I called yesterday at 8pm and nobody picked up. Know how many customers do that and never come back?\"",
        "Offer Gui as the thing that plugs exactly that hole — not as \"one more tool\".",
      ],
      es: [
        "Antes de abordar, LLAMA al negocio a las 20h o un domingo. ¿Nadie contesta? Encontraste el dolor.",
        "Graba o anota: \"Llamé jueves 20h05, cayó al buzón.\" — prueba concreta.",
        "Abre el pitch con eso: \"Llamé ayer a las 20h y nadie contestó. ¿Sabes cuántos clientes hacen eso y no vuelven?\"",
        "Ofrece a Gui como lo que tapa justo ese hueco — no como \"una herramienta más\".",
      ],
    },
  },
  {
    id: "neighborhood-group",
    icon: "🏘️",
    where: "br",
    channel: "whatsapp",
    title: {
      pt: "Grupo de bairro (Facebook/WhatsApp)",
      en: "Neighborhood group (Facebook/WhatsApp)",
      es: "Grupo de barrio (Facebook/WhatsApp)",
    },
    how: {
      pt: [
        "Entre nos grupos de comércio do bairro no WhatsApp e no Facebook — é onde os donos se falam.",
        "Não venda de cara. Comente, ajude, seja o rosto conhecido por 2-3 dias.",
        "Poste UM caso curto: \"Ajudei um restaurante aqui do bairro a parar de perder ligação. Se alguém quiser ver como a IA atende, me chama.\"",
        "Leve a conversa pro privado — feche no áudio, nunca no grupo.",
      ],
      en: [
        "Join the neighborhood commerce groups on WhatsApp and Facebook — that's where owners talk to each other.",
        "Don't sell up front. Comment, help, be the familiar face for 2-3 days.",
        "Post ONE short case: \"Helped a restaurant here in the neighborhood stop losing calls. If anyone wants to see how the AI answers, message me.\"",
        "Move it to DM — close on a voice note, never in the group.",
      ],
      es: [
        "Entra a los grupos de comercio del barrio en WhatsApp y Facebook — ahí hablan los dueños.",
        "No vendas de una. Comenta, ayuda, sé la cara conocida por 2-3 días.",
        "Publica UN caso corto: \"Ayudé a un restaurante del barrio a dejar de perder llamadas. Si alguien quiere ver cómo contesta la IA, escríbeme.\"",
        "Lleva la charla al privado — cierra en audio, nunca en el grupo.",
      ],
    },
  },
  {
    id: "gui-calls-owner-live",
    icon: "✨",
    where: "both",
    channel: "porta",
    title: {
      pt: "Deixa a Gui te ligar agora",
      en: "Let Gui call you right now",
      es: "Deja que Gui te llame ahora",
    },
    how: {
      pt: [
        "A arma mais forte é a demo ao vivo. Não descreva a Gui — faça ela ligar pro celular do dono na frente dele.",
        "Peça o número: \"Me passa seu WhatsApp que em 10 segundos seu telefone toca e você fala com ela.\"",
        "Fique em silêncio enquanto ele conversa com a Gui — deixe a voz vender.",
        "Quando desligar: \"Foi isso que seu cliente ia ouvir às 22h. Quer no nome do seu negócio?\"",
      ],
      en: [
        "The strongest weapon is the live demo. Don't describe Gui — make her call the owner's phone right in front of him.",
        "Ask for the number: \"Give me your WhatsApp and in 10 seconds your phone rings and you talk to her.\"",
        "Stay silent while he talks to Gui — let the voice sell.",
        "When he hangs up: \"That's what your customer would've heard at 10pm. Want it in your business's name?\"",
      ],
      es: [
        "El arma más fuerte es la demo en vivo. No describas a Gui — haz que le llame al celular del dueño frente a él.",
        "Pide el número: \"Dame tu WhatsApp y en 10 segundos suena tu teléfono y hablas con ella.\"",
        "Quédate callado mientras habla con Gui — deja que la voz venda.",
        "Cuando cuelgue: \"Eso es lo que tu cliente iba a escuchar a las 22h. ¿Lo quieres con el nombre de tu negocio?\"",
      ],
    },
  },
  {
    id: "salon-saturday-gap",
    icon: "💇",
    where: "both",
    channel: "instagram",
    title: {
      pt: "O buraco da agenda do salão",
      en: "The salon's calendar gap",
      es: "El hueco de la agenda del salón",
    },
    how: {
      pt: [
        "Ache um salão no Instagram com Stories mostrando horários vagos (\"tenho 15h livre hoje!\").",
        "Responda o Story no direct: \"Vi que sobrou horário. E as clientes que mandam DM de madrugada e ninguém responde?\"",
        "Mostre que a Gui responde DM, liga de volta e preenche o buraco automaticamente.",
        "Ofereça agendar uma call de 10 min — não tente fechar tudo no direct.",
      ],
      en: [
        "Find a salon on Instagram whose Stories show open slots (\"3pm free today!\").",
        "Reply to the Story in DM: \"Saw you had a slot open. What about the clients who DM at midnight and nobody replies?\"",
        "Show that Gui answers DMs, calls back and fills the gap automatically.",
        "Offer a 10-min call — don't try to close everything in the DM.",
      ],
      es: [
        "Encuentra un salón en Instagram cuyas Stories muestren horarios libres (\"¡tengo las 15h libre hoy!\").",
        "Responde la Story por DM: \"Vi que te quedó un hueco. ¿Y las clientas que escriben de madrugada y nadie responde?\"",
        "Muestra que Gui responde DMs, llama de vuelta y llena el hueco automáticamente.",
        "Ofrece una llamada de 10 min — no intentes cerrar todo en el DM.",
      ],
    },
  },
  {
    id: "clinic-no-show",
    icon: "🦷",
    where: "both",
    channel: "porta",
    title: {
      pt: "A conta do no-show na clínica",
      en: "The clinic's no-show math",
      es: "La cuenta del no-show en la clínica",
    },
    how: {
      pt: [
        "Chegue na clínica no fim da manhã e pergunte à recepção: \"Quantas faltas vocês tiveram essa semana?\"",
        "Multiplique faltas × valor da consulta na frente do gestor — vira um número que dói.",
        "Mostre a Gui confirmando e lembrando cada paciente sozinha, além de atender fora do horário.",
        "Feche: \"Se ela evitar 3 faltas por semana, já se paga. Quer testar 30 dias?\"",
      ],
      en: [
        "Show up at the clinic late morning and ask the front desk: \"How many no-shows did you have this week?\"",
        "Multiply no-shows × visit value in front of the manager — it becomes a number that hurts.",
        "Show Gui confirming and reminding every patient on her own, plus answering after hours.",
        "Close: \"If she prevents 3 no-shows a week, she's already paid for herself. Want to test 30 days?\"",
      ],
      es: [
        "Llega a la clínica a media mañana y pregunta en recepción: \"¿Cuántas faltas tuvieron esta semana?\"",
        "Multiplica faltas × valor de la consulta frente al gerente — se vuelve un número que duele.",
        "Muestra a Gui confirmando y recordando a cada paciente sola, además de atender fuera de horario.",
        "Cierra: \"Si evita 3 faltas por semana, ya se paga. ¿Quieres probar 30 días?\"",
      ],
    },
  },
  {
    id: "referral-happy-client",
    icon: "🤝",
    where: "both",
    channel: "telefone",
    title: {
      pt: "Peça indicação no pico da felicidade",
      en: "Ask for a referral at peak happiness",
      es: "Pide referido en el pico de felicidad",
    },
    how: {
      pt: [
        "No dia em que um cliente seu vê o primeiro agendamento cair sozinho, LIGUE pra ele.",
        "Deixe ele comemorar: \"Viu a Gui trabalhando? Como foi?\"",
        "Aí peça: \"Quem você conhece que também perde ligação? Um dono como você.\"",
        "Peça a apresentação por áudio no grupo dele — indicação quente fecha 5x mais rápido.",
      ],
      en: [
        "The day one of your clients sees the first booking land on its own, CALL him.",
        "Let him celebrate: \"Saw Gui working? How was it?\"",
        "Then ask: \"Who do you know that also loses calls? An owner like you.\"",
        "Ask for the intro as a voice note in his group — a warm referral closes 5x faster.",
      ],
      es: [
        "El día que un cliente tuyo ve la primera reserva caer sola, LLÁMALO.",
        "Deja que celebre: \"¿Viste a Gui trabajando? ¿Cómo te fue?\"",
        "Luego pide: \"¿A quién conoces que también pierda llamadas? Un dueño como tú.\"",
        "Pide la presentación por audio en su grupo — un referido caliente cierra 5x más rápido.",
      ],
    },
  },
  {
    id: "food-court-sweep",
    icon: "🏬",
    where: "us",
    channel: "porta",
    title: {
      pt: "A varredura da praça de alimentação",
      en: "The food-court sweep",
      es: "El barrido del patio de comidas",
    },
    how: {
      pt: [
        "Escolha uma praça de alimentação ou rua comercial e trabalhe de porta em porta em 2h.",
        "Mesma abertura em cada uma, cronometrada em 20 segundos — volume vence.",
        "Anote quem disse \"volta depois\" e o horário — 80% das vendas estão no follow-up.",
        "No fim do dia, mande áudio pros \"talvez\": \"Passei aí hoje, lembra? Bora marcar 10 min.\"",
      ],
      en: [
        "Pick a food court or a commercial street and work door-to-door for 2 hours.",
        "Same opener at each one, timed to 20 seconds — volume wins.",
        "Note who said \"come back later\" and when — 80% of sales are in the follow-up.",
        "End of day, voice-note the \"maybes\": \"Stopped by today, remember? Let's grab 10 min.\"",
      ],
      es: [
        "Elige un patio de comidas o una calle comercial y trabaja puerta a puerta por 2 horas.",
        "La misma apertura en cada uno, cronometrada en 20 segundos — el volumen gana.",
        "Anota quién dijo \"vuelve después\" y a qué hora — el 80% de las ventas está en el seguimiento.",
        "Al final del día, manda audio a los \"tal vez\": \"Pasé hoy, ¿recuerdas? Agendemos 10 min.\"",
      ],
    },
  },
  {
    id: "google-reviews-mine",
    icon: "⭐",
    where: "both",
    channel: "email",
    title: {
      pt: "Minere as reviews \"não atenderam\"",
      en: "Mine the \"never answered\" reviews",
      es: "Mina las reseñas \"no contestaron\"",
    },
    how: {
      pt: [
        "No Google Maps, filtre reviews 1-2 estrelas do negócio. Procure \"liguei e ninguém atendeu\", \"não responderam no WhatsApp\".",
        "Copie a frase exata da review pública — é a dor dita pelo próprio cliente dele.",
        "No e-mail/DM pro dono: \"Vi essa review no seu Google: '{frase}'. Isso custa clientes toda semana.\"",
        "Ofereça a Gui como o conserto direto daquela reclamação específica.",
      ],
      en: [
        "On Google Maps, filter the business's 1-2 star reviews. Look for \"called and nobody answered\", \"never replied on WhatsApp\".",
        "Copy the exact line from the public review — it's the pain spoken by his own customer.",
        "In the email/DM to the owner: \"Saw this review on your Google: '{line}'. That costs you customers every week.\"",
        "Offer Gui as the direct fix to that specific complaint.",
      ],
      es: [
        "En Google Maps, filtra las reseñas de 1-2 estrellas del negocio. Busca \"llamé y nadie contestó\", \"no respondieron en WhatsApp\".",
        "Copia la frase exacta de la reseña pública — es el dolor dicho por su propio cliente.",
        "En el email/DM al dueño: \"Vi esta reseña en tu Google: '{frase}'. Eso te cuesta clientes cada semana.\"",
        "Ofrece a Gui como el arreglo directo de esa queja específica.",
      ],
    },
  },
  {
    id: "chamber-event",
    icon: "🎟️",
    where: "us",
    channel: "evento",
    title: {
      pt: "Câmara de comércio / evento local",
      en: "Chamber of commerce / local mixer",
      es: "Cámara de comercio / evento local",
    },
    how: {
      pt: [
        "Vá a um evento de câmara de comércio ou associação de bairro com donos de negócio na sala.",
        "Não fale de você — pergunte: \"O que mais tira seu sono no negócio hoje?\"",
        "Quando alguém tocar em atendimento/telefone, ofereça a demo ao vivo ali mesmo.",
        "Saia com 5 números no WhatsApp — mande áudio de follow-up na mesma noite, enquanto lembram de você.",
      ],
      en: [
        "Go to a chamber of commerce or neighborhood-association event with business owners in the room.",
        "Don't talk about yourself — ask: \"What keeps you up at night about the business right now?\"",
        "When someone touches on phones/service, offer the live demo right there.",
        "Leave with 5 WhatsApp numbers — send a follow-up voice note that same night, while they remember you.",
      ],
      es: [
        "Ve a un evento de cámara de comercio o asociación de barrio con dueños de negocio en la sala.",
        "No hables de ti — pregunta: \"¿Qué es lo que más te quita el sueño del negocio hoy?\"",
        "Cuando alguien toque el tema de teléfono/atención, ofrece la demo en vivo ahí mismo.",
        "Sal con 5 números de WhatsApp — manda audio de seguimiento esa misma noche, mientras te recuerdan.",
      ],
    },
  },
  {
    id: "home-services-emergency",
    icon: "🔧",
    where: "us",
    channel: "telefone",
    title: {
      pt: "A ligação de emergência do encanador",
      en: "The plumber's emergency call",
      es: "La llamada de emergencia del plomero",
    },
    how: {
      pt: [
        "Ligue pra um encanador/eletricista às 21h fingindo emergência real. Caiu na caixa? Ele perdeu o serviço pro próximo da lista.",
        "Na abordagem: \"Liguei ontem 21h com uma emergência. Você não atendeu — quem atendeu ganhou o job.\"",
        "Mostre a Gui atendendo emergência, qualificando e mandando o endereço pro dono na hora.",
        "Feche na dor do dinheiro perdido: \"Cada emergência perdida é um serviço inteiro no bolso do concorrente.\"",
      ],
      en: [
        "Call a plumber/electrician at 9pm faking a real emergency. Went to voicemail? He lost the job to the next name on the list.",
        "In the pitch: \"I called last night at 9pm with an emergency. You didn't answer — whoever did got the job.\"",
        "Show Gui taking the emergency, qualifying it and texting the address to the owner instantly.",
        "Close on the money lost: \"Every missed emergency is a whole job in your competitor's pocket.\"",
      ],
      es: [
        "Llama a un plomero/electricista a las 21h fingiendo una emergencia real. ¿Cayó al buzón? Perdió el trabajo con el próximo de la lista.",
        "En el pitch: \"Llamé anoche a las 21h con una emergencia. No contestaste — quien contestó ganó el trabajo.\"",
        "Muestra a Gui atendiendo la emergencia, calificándola y mandando la dirección al dueño al instante.",
        "Cierra en el dinero perdido: \"Cada emergencia perdida es un trabajo entero en el bolsillo del competidor.\"",
      ],
    },
  },
  {
    id: "before-you-open",
    icon: "🌅",
    where: "both",
    channel: "porta",
    title: {
      pt: "Chegue antes de abrir",
      en: "Show up before they open",
      es: "Llega antes de que abran",
    },
    how: {
      pt: [
        "Chegue 20 min antes do negócio abrir. O dono está lá, calmo, sem cliente pra atender.",
        "Traga um café: \"Trouxe um pra você, só quero 5 minutos antes da correria.\"",
        "É o único momento do dia em que ele te escuta inteiro — use pra demo ao vivo.",
        "Se ele curtir, marque de voltar no mesmo horário amanhã com a proposta pronta.",
      ],
      en: [
        "Arrive 20 min before the business opens. The owner is there, calm, no customers to serve.",
        "Bring a coffee: \"Got one for you, I just want 5 minutes before the rush.\"",
        "It's the only moment of the day he'll hear you out fully — use it for the live demo.",
        "If he likes it, set to come back same time tomorrow with the proposal ready.",
      ],
      es: [
        "Llega 20 min antes de que abra el negocio. El dueño está ahí, tranquilo, sin clientes que atender.",
        "Lleva un café: \"Traje uno para ti, solo quiero 5 minutos antes del ajetreo.\"",
        "Es el único momento del día en que te escucha completo — úsalo para la demo en vivo.",
        "Si le gusta, agenda volver a la misma hora mañana con la propuesta lista.",
      ],
    },
  },
  {
    id: "instagram-dm-voice",
    icon: "📱",
    where: "br",
    channel: "instagram",
    title: {
      pt: "Direct com áudio (não texto)",
      en: "DM with a voice note (not text)",
      es: "DM con audio (no texto)",
    },
    how: {
      pt: [
        "No Instagram do negócio, mande um áudio no direct — 90% mandam texto, você vira o único com voz.",
        "Elogie algo REAL do perfil primeiro: \"Vi o post do prato novo, ficou lindo.\"",
        "Emenda a dor: \"Aposto que chega DM de madrugada querendo reservar e ninguém responde, né?\"",
        "Peça 10 min de call — nunca cole link de venda no primeiro contato.",
      ],
      en: [
        "On the business's Instagram, send a voice note in the DM — 90% send text, you become the only voice.",
        "Compliment something REAL on the profile first: \"Saw the new-dish post, looks amazing.\"",
        "Bridge to the pain: \"Bet you get DMs at midnight wanting to book and nobody replies, right?\"",
        "Ask for a 10-min call — never drop a sales link on first contact.",
      ],
      es: [
        "En el Instagram del negocio, manda un audio en el DM — el 90% manda texto, tú eres la única voz.",
        "Elogia algo REAL del perfil primero: \"Vi el post del plato nuevo, quedó hermoso.\"",
        "Enlaza al dolor: \"Apuesto que llegan DMs de madrugada queriendo reservar y nadie responde, ¿no?\"",
        "Pide 10 min de llamada — nunca pegues un link de venta en el primer contacto.",
      ],
    },
  },
  {
    id: "competitor-answered",
    icon: "🥊",
    where: "both",
    channel: "porta",
    title: {
      pt: "O concorrente atendeu, você não",
      en: "The competitor answered, you didn't",
      es: "El competidor contestó, tú no",
    },
    how: {
      pt: [
        "Antes da visita, ligue pro alvo E pro concorrente da rua no mesmo horário fora do expediente.",
        "Se o concorrente atendeu e seu alvo não, você tem a jogada mais forte que existe.",
        "\"Liguei pra você e pro {concorrente} ontem à noite. Adivinha quem atendeu? Ele ganhou meu dinheiro.\"",
        "A Gui coloca ele no mesmo nível — ou à frente, atendendo 24/7.",
      ],
      en: [
        "Before the visit, call the target AND the competitor down the street at the same after-hours time.",
        "If the competitor answered and your target didn't, you've got the strongest play there is.",
        "\"I called you and {competitor} last night. Guess who picked up? He got my money.\"",
        "Gui puts him on the same level — or ahead, answering 24/7.",
      ],
      es: [
        "Antes de la visita, llama al objetivo Y al competidor de la calle a la misma hora fuera de horario.",
        "Si el competidor contestó y tu objetivo no, tienes la jugada más fuerte que existe.",
        "\"Te llamé a ti y a {competidor} anoche. ¿Adivina quién contestó? Él se llevó mi dinero.\"",
        "Gui lo pone al mismo nivel — o adelante, atendiendo 24/7.",
      ],
    },
  },
  {
    id: "realtor-lead-speed",
    icon: "🏠",
    where: "us",
    channel: "telefone",
    title: {
      pt: "A velocidade do lead imobiliário",
      en: "The real-estate lead-speed play",
      es: "La velocidad del lead inmobiliario",
    },
    how: {
      pt: [
        "Corretores sabem: lead que espera 5 min esfria. Use isso como abertura.",
        "\"Quanto tempo você leva pra ligar de volta pra um lead? A Gui liga em 60 segundos, sempre.\"",
        "Mostre a Gui pegando o lead do portal, qualificando e já agendando a visita.",
        "Feche no ROI de UM negócio: \"Se ela fechar uma visita a mais por mês, pagou o ano.\"",
      ],
      en: [
        "Realtors know: a lead that waits 5 min goes cold. Use that as your opener.",
        "\"How long do you take to call a lead back? Gui calls in 60 seconds, every time.\"",
        "Show Gui grabbing the portal lead, qualifying it and booking the showing.",
        "Close on ONE deal's ROI: \"If she books one extra showing a month, she paid for the year.\"",
      ],
      es: [
        "Los agentes saben: un lead que espera 5 min se enfría. Usa eso como apertura.",
        "\"¿Cuánto tardas en devolver la llamada a un lead? Gui llama en 60 segundos, siempre.\"",
        "Muestra a Gui tomando el lead del portal, calificándolo y agendando la visita.",
        "Cierra en el ROI de UN negocio: \"Si agenda una visita más al mes, pagó el año.\"",
      ],
    },
  },
  {
    id: "linkedin-owner",
    icon: "💼",
    where: "us",
    channel: "email",
    title: {
      pt: "LinkedIn direto no dono",
      en: "LinkedIn straight to the owner",
      es: "LinkedIn directo al dueño",
    },
    how: {
      pt: [
        "Ache o dono (não gerente) no LinkedIn. Conecte com nota de UMA linha, sem pitch.",
        "Quando aceitar, mande a dor específica do setor dele — mostre que você fez o dever de casa.",
        "Ofereça um vídeo de 60s da Gui atendendo um negócio parecido (o roteiro do Kit de Lançamento).",
        "Termine com CTA leve: \"Vale 10 min essa semana?\"",
      ],
      en: [
        "Find the owner (not a manager) on LinkedIn. Connect with a ONE-line note, no pitch.",
        "When they accept, send the specific pain of their sector — show you did the homework.",
        "Offer a 60s video of Gui answering a similar business (the Launch Kit script).",
        "End with a light CTA: \"Worth 10 min this week?\"",
      ],
      es: [
        "Encuentra al dueño (no gerente) en LinkedIn. Conecta con una nota de UNA línea, sin pitch.",
        "Cuando acepte, manda el dolor específico de su sector — muestra que hiciste la tarea.",
        "Ofrece un video de 60s de Gui atendiendo un negocio parecido (el guion del Kit de Lanzamiento).",
        "Termina con un CTA ligero: \"¿Vale 10 min esta semana?\"",
      ],
    },
  },
  {
    id: "gym-trial-followup",
    icon: "🏋️",
    where: "both",
    channel: "porta",
    title: {
      pt: "O trial da academia que ninguém liga",
      en: "The gym trial nobody calls back",
      es: "La prueba del gym que nadie llama",
    },
    how: {
      pt: [
        "Pergunte ao dono da academia: \"Quantos fizeram aula experimental esse mês? Quantos você ligou de volta?\"",
        "O gap entre os dois números é dinheiro na mesa — mostre isso.",
        "A Gui liga todo trial em 1h, reativa quem sumiu e avisa quem tá pra cancelar.",
        "Feche: \"Recuperar 2 matrículas por mês já paga 3x. Bora testar?\"",
      ],
      en: [
        "Ask the gym owner: \"How many did a trial class this month? How many did you call back?\"",
        "The gap between those two numbers is money on the table — show it.",
        "Gui calls every trial within an hour, wins back the ones who vanished and flags who's about to cancel.",
        "Close: \"Recovering 2 memberships a month already pays 3x. Let's test it?\"",
      ],
      es: [
        "Pregunta al dueño del gym: \"¿Cuántos hicieron clase de prueba este mes? ¿A cuántos llamaste de vuelta?\"",
        "La brecha entre esos dos números es dinero en la mesa — muéstrala.",
        "Gui llama a cada prueba en 1h, reactiva a los que desaparecieron y avisa quién está por cancelar.",
        "Cierra: \"Recuperar 2 membresías al mes ya paga 3x. ¿Probamos?\"",
      ],
    },
  },
  {
    id: "saturday-market",
    icon: "🛒",
    where: "br",
    channel: "evento",
    title: {
      pt: "Feira e mercado de sábado",
      en: "Saturday street market",
      es: "Feria y mercado del sábado",
    },
    how: {
      pt: [
        "Sábado de manhã, vá à feira/mercadão onde tem dono de comércio comprando e conversando.",
        "Clima é leve — puxe papo sobre o negócio, sem crachá de vendedor.",
        "Quando abrir espaço, faça a Gui ligar no celular dele ali mesmo, no meio da feira.",
        "Pegue o WhatsApp e mande áudio no domingo: \"Foi bom te conhecer ontem, bora marcar?\"",
      ],
      en: [
        "Saturday morning, go to the street market where shop owners are buying and chatting.",
        "The vibe is easy — chat about the business, no salesman badge.",
        "When there's an opening, have Gui call his phone right there in the middle of the market.",
        "Grab the WhatsApp and voice-note on Sunday: \"Great meeting you yesterday, let's set a time?\"",
      ],
      es: [
        "Sábado en la mañana, ve a la feria/mercado donde hay dueños de comercio comprando y charlando.",
        "El ambiente es ligero — charla sobre el negocio, sin credencial de vendedor.",
        "Cuando se abra el espacio, haz que Gui le llame al celular ahí mismo, en plena feria.",
        "Toma el WhatsApp y manda audio el domingo: \"Qué bueno conocerte ayer, ¿agendamos?\"",
      ],
    },
  },
  {
    id: "roi-napkin",
    icon: "🧮",
    where: "both",
    channel: "porta",
    title: {
      pt: "A conta no guardanapo",
      en: "The napkin math",
      es: "La cuenta en la servilleta",
    },
    how: {
      pt: [
        "Peça um guardanapo ou pedaço de papel e faça a conta À MÃO na frente do dono — vale mais que qualquer slide.",
        "Ligações perdidas/dia × ticket médio × dias no mês = o rombo, escrito no papel dele.",
        "Embaixo escreva o preço da Gui e circule a diferença. O número fala sozinho.",
        "Deixe o papel com ele: \"Guarda isso. Se eu estiver errado, me liga.\"",
      ],
      en: [
        "Ask for a napkin or scrap of paper and do the math BY HAND in front of the owner — beats any slide.",
        "Missed calls/day × average ticket × days in the month = the hole, written on his own paper.",
        "Below it, write Gui's price and circle the difference. The number speaks for itself.",
        "Leave the paper with him: \"Keep this. If I'm wrong, call me.\"",
      ],
      es: [
        "Pide una servilleta o un papel y haz la cuenta A MANO frente al dueño — vale más que cualquier slide.",
        "Llamadas perdidas/día × ticket promedio × días del mes = el hueco, escrito en su propio papel.",
        "Debajo escribe el precio de Gui y encierra la diferencia. El número habla solo.",
        "Déjale el papel: \"Guárdalo. Si me equivoco, llámame.\"",
      ],
    },
  },
  {
    id: "law-intake-lost",
    icon: "⚖️",
    where: "us",
    channel: "email",
    title: {
      pt: "O intake que o escritório perde à noite",
      en: "The intake the law firm loses at night",
      es: "El intake que el bufete pierde de noche",
    },
    how: {
      pt: [
        "Advogado sabe o valor de UM caso. Abra por aí: \"Quanto vale um cliente novo pro seu escritório?\"",
        "\"E quantos ligam depois das 18h, caem na secretária e contratam o próximo da lista?\"",
        "A Gui faz o intake inicial, qualifica e agenda a consulta — mesmo às 23h.",
        "Feche no valor de um caso: \"Um intake salvo por mês já pagou o ano inteiro.\"",
      ],
      en: [
        "A lawyer knows what ONE case is worth. Open there: \"What's a new client worth to your firm?\"",
        "\"And how many call after 6pm, hit voicemail and hire the next name on the list?\"",
        "Gui runs the initial intake, qualifies it and books the consult — even at 11pm.",
        "Close on one case's value: \"One saved intake a month already paid for the whole year.\"",
      ],
      es: [
        "Un abogado sabe cuánto vale UN caso. Abre por ahí: \"¿Cuánto vale un cliente nuevo para tu bufete?\"",
        "\"¿Y cuántos llaman después de las 18h, caen al buzón y contratan al próximo de la lista?\"",
        "Gui hace el intake inicial, lo califica y agenda la consulta — incluso a las 23h.",
        "Cierra en el valor de un caso: \"Un intake salvado al mes ya pagó todo el año.\"",
      ],
    },
  },
  {
    id: "vendor-cross-referral",
    icon: "🔁",
    where: "both",
    channel: "telefone",
    title: {
      pt: "Parceria com quem já vende pro dono",
      en: "Partner with who already sells to owners",
      es: "Alianza con quien ya vende al dueño",
    },
    how: {
      pt: [
        "Contadores, agências e fornecedores de POS já têm a confiança de dezenas de donos.",
        "Ofereça comissão de indicação: \"Cada cliente seu que fechar, você ganha.\"",
        "Dê a ele o mesmo vídeo de 60s da Gui pra mandar na base dele.",
        "Uma parceria dessas vale 10 portas frias — cultive 2-3 por mês.",
      ],
      en: [
        "Accountants, agencies and POS vendors already have the trust of dozens of owners.",
        "Offer a referral cut: \"Every client of yours that closes, you earn.\"",
        "Give them the same 60s Gui video to send to their base.",
        "One partnership like that beats 10 cold doors — cultivate 2-3 a month.",
      ],
      es: [
        "Contadores, agencias y proveedores de POS ya tienen la confianza de decenas de dueños.",
        "Ofrece comisión de referido: \"Cada cliente tuyo que cierre, tú ganas.\"",
        "Dale el mismo video de 60s de Gui para mandar a su base.",
        "Una alianza así vale 10 puertas frías — cultiva 2-3 al mes.",
      ],
    },
  },
  {
    id: "second-visit-proposal",
    icon: "📄",
    where: "both",
    channel: "porta",
    title: {
      pt: "A segunda visita com a proposta na mão",
      en: "The second visit, proposal in hand",
      es: "La segunda visita con la propuesta en mano",
    },
    how: {
      pt: [
        "Raramente se fecha na primeira. Marque a segunda visita ao SAIR da primeira: \"Volto quinta 15h com os números do SEU negócio.\"",
        "Traga a proposta impressa com o nome e o setor dele já preenchidos — parece feito sob medida.",
        "Reabra com a demo: faça a Gui ligar de novo, agora ele já sabe o que esperar.",
        "Tenha o link de pagamento pronto no celular pra fechar na hora do sim.",
      ],
      en: [
        "You rarely close on the first. Book the second visit as you LEAVE the first: \"Back Thursday 3pm with YOUR business's numbers.\"",
        "Bring the proposal printed with his name and sector already filled in — looks tailor-made.",
        "Reopen with the demo: have Gui call again, now he knows what to expect.",
        "Have the payment link ready on your phone to close the moment he says yes.",
      ],
      es: [
        "Rara vez cierras en la primera. Agenda la segunda visita al SALIR de la primera: \"Vuelvo jueves 15h con los números de TU negocio.\"",
        "Trae la propuesta impresa con su nombre y sector ya rellenados — parece hecha a la medida.",
        "Reabre con la demo: haz que Gui llame de nuevo, ahora ya sabe qué esperar.",
        "Ten el link de pago listo en el celular para cerrar en el momento del sí.",
      ],
    },
  },
  {
    id: "auto-dealer-test-drive",
    icon: "🚗",
    where: "us",
    channel: "porta",
    title: {
      pt: "O test-drive não confirmado",
      en: "The unconfirmed test drive",
      es: "El test-drive sin confirmar",
    },
    how: {
      pt: [
        "Na concessionária, pergunte ao gerente: \"Quantos test-drives agendados não aparecem?\"",
        "Cada no-show é um vendedor parado esperando — custo real que ele sente.",
        "A Gui confirma o test-drive, responde dúvida de financiamento fora do horário e reagenda quem falha.",
        "Feche no volume: \"Numa concessionária, um carro a mais no mês paga a Gui o ano inteiro.\"",
      ],
      en: [
        "At the dealership, ask the manager: \"How many booked test drives just don't show?\"",
        "Every no-show is a salesperson standing around waiting — a real cost he feels.",
        "Gui confirms the test drive, answers financing questions after hours and reschedules the ones who flake.",
        "Close on volume: \"At a dealership, one extra car a month pays for Gui all year.\"",
      ],
      es: [
        "En la concesionaria, pregunta al gerente: \"¿Cuántos test-drives agendados no aparecen?\"",
        "Cada no-show es un vendedor parado esperando — un costo real que él siente.",
        "Gui confirma el test-drive, responde dudas de financiamiento fuera de horario y reagenda a quien falla.",
        "Cierra en el volumen: \"En una concesionaria, un auto más al mes paga a Gui todo el año.\"",
      ],
    },
  },
  {
    id: "voice-note-monday",
    icon: "📤",
    where: "br",
    channel: "whatsapp",
    title: {
      pt: "A onda de áudios de segunda de manhã",
      en: "The Monday-morning voice-note wave",
      es: "La ola de audios del lunes por la mañana",
    },
    how: {
      pt: [
        "Segunda 9h, o dono está planejando a semana e mais aberto. Prepare 10 áudios personalizados.",
        "Cada um começa com o nome dele e uma referência real ao negócio — nada de copiar e colar frio.",
        "Mande os 10 em 30 min. Meta: 3 respostas, 1 call marcada.",
        "Quem não responder até quarta, ligue. Áudio abre a porta, ligação fecha.",
      ],
      en: [
        "Monday 9am the owner is planning the week and more open. Prep 10 personalized voice notes.",
        "Each opens with his name and a real reference to the business — no cold copy-paste.",
        "Send all 10 in 30 min. Goal: 3 replies, 1 call booked.",
        "Whoever doesn't reply by Wednesday, call. Audio opens the door, the call closes.",
      ],
      es: [
        "Lunes 9h el dueño está planeando la semana y más abierto. Prepara 10 audios personalizados.",
        "Cada uno abre con su nombre y una referencia real al negocio — nada de copiar y pegar frío.",
        "Manda los 10 en 30 min. Meta: 3 respuestas, 1 llamada agendada.",
        "Quien no responda para el miércoles, llámalo. El audio abre la puerta, la llamada cierra.",
      ],
    },
  },
  {
    id: "ecommerce-cart",
    icon: "🛍️",
    where: "both",
    channel: "instagram",
    title: {
      pt: "O carrinho abandonado da lojinha",
      en: "The boutique's abandoned cart",
      es: "El carrito abandonado de la tienda",
    },
    how: {
      pt: [
        "Lojinha de Instagram vive de DM. Pergunte: \"Quantas clientes perguntam preço/tamanho e você só vê no dia seguinte?\"",
        "Cada DM sem resposta em 1h é uma venda que foi pro concorrente.",
        "A Gui responde DM na hora, tira dúvida de tamanho e fecha a venda até com link de pagamento.",
        "Mostre um caso: \"DM de madrugada respondida = venda que existia e sumia.\"",
      ],
      en: [
        "An Instagram shop lives on DMs. Ask: \"How many customers ask price/size and you only see it the next day?\"",
        "Every DM unanswered for an hour is a sale that went to a competitor.",
        "Gui replies to DMs instantly, handles sizing questions and even closes the sale with a payment link.",
        "Show a case: \"A midnight DM answered = a sale that existed and was vanishing.\"",
      ],
      es: [
        "Una tienda de Instagram vive de los DMs. Pregunta: \"¿Cuántas clientas preguntan precio/talla y lo ves al día siguiente?\"",
        "Cada DM sin responder en 1h es una venta que se fue al competidor.",
        "Gui responde DMs al instante, resuelve dudas de talla y hasta cierra la venta con link de pago.",
        "Muestra un caso: \"Un DM de madrugada respondido = una venta que existía y se esfumaba.\"",
      ],
    },
  },
  {
    id: "sunday-scout",
    icon: "🔍",
    where: "both",
    channel: "telefone",
    title: {
      pt: "O reconhecimento de domingo",
      en: "The Sunday scouting run",
      es: "El reconocimiento del domingo",
    },
    how: {
      pt: [
        "Domingo, faça a lição de casa: ligue pra 15 alvos da semana e anote quem não atende.",
        "Monte a lista de segunda com a prova na mão: \"Liguei domingo 19h, não atenderam.\"",
        "Priorize os que caíram na caixa — são os mais fáceis de convencer da dor.",
        "Segunda você chega quente, com dado real, não achismo. Preparação vence talento.",
      ],
      en: [
        "On Sunday, do the homework: call 15 of the week's targets and note who doesn't answer.",
        "Build Monday's list with the proof in hand: \"Called Sunday 7pm, no answer.\"",
        "Prioritize the ones that went to voicemail — easiest to convince of the pain.",
        "Monday you arrive hot, with real data, not guesswork. Prep beats talent.",
      ],
      es: [
        "El domingo, haz la tarea: llama a 15 objetivos de la semana y anota quién no contesta.",
        "Arma la lista del lunes con la prueba en mano: \"Llamé domingo 19h, no contestaron.\"",
        "Prioriza los que cayeron al buzón — los más fáciles de convencer del dolor.",
        "El lunes llegas caliente, con dato real, no suposición. La preparación vence al talento.",
      ],
    },
  },
  {
    id: "education-enrollment",
    icon: "📚",
    where: "both",
    channel: "porta",
    title: {
      pt: "A matrícula que o curso não confirma",
      en: "The enrollment the school never confirms",
      es: "La matrícula que la escuela no confirma",
    },
    how: {
      pt: [
        "Escola de idioma/reforço perde aluno no follow-up. Pergunte: \"Quantos pediram info e nunca voltaram?\"",
        "A Gui liga cada interessado, responde sobre horário e preço e agenda a aula experimental.",
        "Mostre a reativação: ela puxa quem sumiu na virada do semestre.",
        "Feche na sazonalidade: \"Em época de matrícula, ela trabalha as 3h da manhã que você dorme.\"",
      ],
      en: [
        "Language/tutoring schools lose students in the follow-up. Ask: \"How many asked for info and never came back?\"",
        "Gui calls every prospect, answers on schedule and price and books the trial class.",
        "Show the reactivation: she pulls back the ones who vanished at the semester turn.",
        "Close on seasonality: \"In enrollment season she works the 3am you're asleep.\"",
      ],
      es: [
        "Escuela de idiomas/refuerzo pierde alumnos en el seguimiento. Pregunta: \"¿Cuántos pidieron info y nunca volvieron?\"",
        "Gui llama a cada interesado, responde sobre horario y precio y agenda la clase de prueba.",
        "Muestra la reactivación: recupera a los que desaparecieron en el cambio de semestre.",
        "Cierra en la estacionalidad: \"En época de matrícula, trabaja las 3 de la mañana que tú duermes.\"",
      ],
    },
  },
  {
    id: "give-before-ask",
    icon: "🎁",
    where: "both",
    channel: "porta",
    title: {
      pt: "Dê valor antes de pedir",
      en: "Give value before you ask",
      es: "Da valor antes de pedir",
    },
    how: {
      pt: [
        "Antes de vender, entregue algo grátis: aponte um problema real no Google/Instagram do negócio.",
        "\"Reparei que seu horário no Google tá errado — corrige que aparece mais. Aliás, sobre o telefone...\"",
        "Você vira o cara que ajudou, não o que veio tirar. A porta abre sozinha.",
        "Só então apresente a Gui — agora com crédito na conta da confiança.",
      ],
      en: [
        "Before selling, give something free: point out a real problem in the business's Google/Instagram.",
        "\"Noticed your Google hours are wrong — fix that and you show up more. By the way, about the phone...\"",
        "You become the guy who helped, not the one who came to take. The door opens on its own.",
        "Only then introduce Gui — now with credit in the trust account.",
      ],
      es: [
        "Antes de vender, entrega algo gratis: señala un problema real en el Google/Instagram del negocio.",
        "\"Noté que tu horario en Google está mal — corrígelo y apareces más. Por cierto, sobre el teléfono...\"",
        "Te vuelves el que ayudó, no el que vino a quitar. La puerta se abre sola.",
        "Solo entonces presenta a Gui — ahora con crédito en la cuenta de la confianza.",
      ],
    },
  },
  {
    id: "end-of-day-recap",
    icon: "🌙",
    where: "both",
    channel: "whatsapp",
    title: {
      pt: "O follow-up da mesma noite",
      en: "The same-night follow-up",
      es: "El seguimiento de la misma noche",
    },
    how: {
      pt: [
        "Todo dia às 20h, mande áudio pra cada dono que você abordou hoje — enquanto ainda lembra do seu rosto.",
        "\"Prazer te conhecer hoje, {nome}. Fiquei pensando naquela questão das ligações perdidas.\"",
        "Reforce UM ponto que ele demonstrou dor e proponha o próximo passo concreto.",
        "Follow-up no mesmo dia dobra a taxa de resposta — 24h depois você já é estranho.",
      ],
      en: [
        "Every day at 8pm, voice-note each owner you approached today — while your face is still fresh.",
        "\"Great meeting you today, {nome}. Been thinking about that missed-calls thing.\"",
        "Reinforce ONE point where he showed pain and propose the next concrete step.",
        "Same-day follow-up doubles the reply rate — 24h later you're already a stranger.",
      ],
      es: [
        "Todos los días a las 20h, manda audio a cada dueño que abordaste hoy — mientras aún recuerda tu cara.",
        "\"Un gusto conocerte hoy, {nome}. Estuve pensando en eso de las llamadas perdidas.\"",
        "Refuerza UN punto donde mostró dolor y propón el siguiente paso concreto.",
        "El seguimiento del mismo día duplica la tasa de respuesta — 24h después ya eres un extraño.",
      ],
    },
  },
];

// Deterministic "play of the day" — same all day, rotates on its own tomorrow. Uses the calendar
// day so the whole team sees the same suggested move; wraps modulo the list length.
export function playOfTheDay(date = new Date()) {
  return SELLER_PLAYS[date.getDate() % SELLER_PLAYS.length];
}

// Channel + market filter vocab (labels live in the component's dict; these are the stable keys).
export const PLAY_CHANNELS = ["porta", "telefone", "whatsapp", "instagram", "email", "evento"];
export const PLAY_MARKETS = ["us", "br"];
