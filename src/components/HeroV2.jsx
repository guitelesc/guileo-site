import { useState, useEffect } from "react";
import mark from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";
// O capturador de lead do herói. Import DIRETO (não lazy) de propósito: é o elemento da dobra que
// converte tráfego pago — carregar depois é o mesmo que não ter.
import LiveCallBar from "./LiveCallBar.jsx";

// Hero copy that lives in the component (richer than the shared dict) — translated inline.
//
// ── REESCRITA 2026-08-17 ────────────────────────────────────────────────────────────────────────
// O Luis olhou a tela e disse que este texto não estava bom. Ele estava certo, e o defeito não era
// escolha de palavra: TUDO ABAIXO DO TÍTULO REPETIA O TÍTULO com palavras mais fracas.
//   · "24/7" aparecia TRÊS vezes na mesma dobra: nesta frase, no número laranja e colado no botão.
//   · Os mesmos três verbos, duas vezes: o h1 diz "answers, books & sells" e a frase logo abaixo
//     dizia "answers, books, quotes and collects".
//   · "never sleeps, never calls in sick" é o clichê mais batido da categoria — e estava idêntico
//     nas 143 páginas de SEO, então nem era nosso.
//   · "Real AI · real calls · real bookings": três "real" seguidos. Repetir que é real é a frase de
//     quem está sendo acusado de não ser.
// Repetição na dobra de cima não soa a ênfase, soa a quem só tem uma coisa pra dizer.
//
// O QUE ENTROU NO LUGAR — o subtítulo passou a dizer o que o título NÃO PODE dizer:
//   · "at 2am, on a Sunday" no lugar de "24/7". A mesma informação, mas com hora e dia a pessoa VÊ
//     a cena; "24/7" ela já leu em todo site de software e não vê nada.
//   · A aritmética no lugar do clichê: aberto ~50h, o telefone toca 168, sobram 118. Qualquer dono
//     confere de cabeça, e é a única frase desta página que nenhum concorrente está usando.
//   · O botão passou a dizer o que ACONTECE ao clicar (ela liga em cerca de um minuto) em vez de
//     jurar que é real. Promessa verificável, e verificada: o #try coleta o número e dispara a
//     ligação na hora (DemoEngine "A Gui está te ligando agora").
// "Você compra o resultado, não a ferramenta" FICOU: é o posicionamento contra quem vende software
// — só saiu do fim de uma lista, onde ninguém lia, para o fim da frase, onde fecha o raciocínio.

// ── "GESTÃO" ENTROU NA DOBRA (2026-08-20, auditoria de posicionamento) ─────────────────────────
// O Luis foi explícito: «tem que estar claro que somos uma business/marketing AI, automação,
// SOFTWARE, MANAGEMENT». A palavra GESTÃO não aparecia em lugar nenhum da dobra nem do menu — quem
// procura "management AI" não se reconhecia aqui.
// ⚠️ NÃO É PROMESSA NOVA. A evidência é o cockpit do cliente, que já existe e já está no ar:
// `src/portal/` tem 69 arquivos de tela, e o `src/pages/Portal.jsx` monta como abas reais
// CRM360.jsx (CRM 360), ScheduleScreen.jsx (agenda), FinanceDept.jsx + Payments.jsx + Billing.jsx
// (financeiro), Team.jsx (equipe), Operations.jsx (operação) e MyCompanyOS.jsx (os 8 departamentos
// do Company OS do cliente). Isso É gestão; só não estava sendo DITO.
// BISTURI, NÃO MARRETA — a dobra é a peça mais delicada do site, então foram DUAS palavras e zero
// mudança de layout:
//   1. o eyebrow ganhou um quarto termo na enumeração que já existia (AI · anúncios · criativo ·
//      GESTÃO). É a linha de 3 segundos, é onde a busca por "management" precisa bater;
//   2. a linha `tudo` passou de "constrói e OPERA" para "constrói, opera e GERENCIA" — o verbo que
//      faltava na frase que já respondia "isso é só o telefone ou é a operação inteira?".
// NÃO foi para o menu: o seletor de idioma já foi refeito uma vez porque um rótulo a mais soterrava
// o "Blog" em 1280px (ver Navbar.jsx). Item novo lá reabre esse defeito para ganhar menos.
const HERO_COPY = {
  en: { eyebrow:"AI · ads · creative · management — the agency that grows local businesses", sub:["A missed call doesn't leave a voicemail — it calls the next place on Google. "," answers in your customer's language and takes the deposit before they hang up. You buy the ","result, not the tools","."], cta:"Hear Gui work", sub2:"Leave your number — she calls in about a minute.", h1:["We bring the customers.","AI answers, books & sells.","You grow."], promessa:"Work Smart. Grow Faster. Sleep Better." , tudo:"Everything we build, run and manage for you" },
  pt: { eyebrow:"AI · anúncios · criativo · gestão — a agência que faz o negócio local crescer", sub:["A ligação perdida não deixa recado — ela liga pro próximo da lista do Google. A "," atende no idioma do seu cliente e já pega o sinal antes de desligar. Você compra o ","resultado, não a ferramenta","."], cta:"Ouça a Gui trabalhar", sub2:"Deixa seu número — ela liga em mais ou menos um minuto.", h1:["A gente traz os clientes.","A AI atende, agenda e vende.","Você cresce."], promessa:"Trabalhe com inteligência. Cresça mais rápido. Durma melhor." , tudo:"Tudo o que a gente constrói, opera e gerencia pra você" },
  es: { eyebrow:"IA · anuncios · creativo · gestión — la agencia que hace crecer al negocio local", sub:["La llamada perdida no deja mensaje — llama al siguiente de la lista de Google. "," contesta en el idioma de tu cliente y cobra el anticipo antes de colgar. Compras el ","resultado, no la herramienta","."], cta:"Escucha a Gui trabajar", sub2:"Deja tu número — te llama en un minuto.", h1:["Nosotros traemos los clientes.","La IA contesta, agenda y vende.","Tú creces."], promessa:"Trabaja inteligente. Crece más rápido. Duerme mejor." , tudo:"Todo lo que construimos, operamos y gestionamos para ti" },
  hi: { eyebrow:"AI · विज्ञापन · क्रिएटिव · प्रबंधन — स्थानीय व्यवसाय बढ़ाने वाली एजेंसी", sub:["छूटी हुई कॉल मैसेज नहीं छोड़ती — वो Google पर अगली दुकान को कॉल करती है। "," आपके ग्राहक की भाषा में जवाब देती है और फ़ोन रखने से पहले एडवांस ले लेती है। आप ","नतीजा खरीदते हैं, टूल नहीं","।"], cta:"Gui को काम करते सुनें", sub2:"अपना नंबर छोड़ें — वो लगभग एक मिनट में कॉल करती है।", h1:["ग्राहक हम लाते हैं।","AI जवाब देती, बुक करती और बेचती है।","आप बढ़ते हैं।"], promessa:"होशियारी से काम। तेज़ी से बढ़ें। चैन से सोएँ।" , tudo:"वह सब जो हम आपके लिए बनाते, चलाते और मैनेज करते हैं" },
};


// HeroV2 — TEST (/v2). Realistic, LIVING iPhone-2026 mockup of Gui working nonstop.
// SMOOTH motion: the action feed is a continuous gliding marquee (no janky remounts),
// the header business/line crossfades gently, the call timer ticks, the floating proof
// cards (services + profit + numbers) rotate with soft crossfades. Plant is back behind.
// All motion = CSS transforms + eased crossfades (framer `animate` is unreliable here).

// ── O FEED DO TELEFONE, NOS 4 IDIOMAS (2026-08-11) ──────────────────────────────────────────────
// Estas 17 linhas eram STRINGS FIXAS EM INGLÊS. A página inteira já trocava de idioma; só o
// telefone — a peça mais olhada do herói — continuava dizendo "Booked", "Sale logged", "Quote
// sent" para um visitante lendo português. É a mesma classe do bug da voz que falava metade em
// inglês numa ligação brasileira: não quebra nada, não dá erro, e denuncia na hora que quem está
// do outro lado é uma máquina montada para outro público.
// Nomes próprios ficam (Maria, João, Carlos); o que localiza é HORA, MOEDA e verbo — que é
// exatamente onde a tradução automática costuma errar e onde o olho do dono bate primeiro.
const POOL = [
  { icon: "📅", label: { en: "Booked", pt: "Agendado", es: "Agendado", hi: "बुक हुआ" }, detail: { en: "Maria · Sat 3:00 PM", pt: "Maria · sáb 15:00", es: "María · sáb 15:00", hi: "मारिया · शनि 3:00 PM" } },
  { icon: "💳", label: { en: "Sale logged", pt: "Venda registrada", es: "Venta registrada", hi: "बिक्री दर्ज" }, detail: { en: "$85 · card on file", pt: "US$ 85 · cartão salvo", es: "$85 · tarjeta guardada", hi: "$85 · कार्ड सेव" } },
  { icon: "🧾", label: { en: "Quote sent", pt: "Orçamento enviado", es: "Cotización enviada", hi: "कोटेशन भेजा" }, detail: { en: "Kitchen remodel · $4,200", pt: "Reforma de cozinha · US$ 4.200", es: "Reforma de cocina · $4,200", hi: "किचन रीमॉडल · $4,200" } },
  { icon: "⭐", label: { en: "Review requested", pt: "Avaliação pedida", es: "Reseña solicitada", hi: "समीक्षा माँगी" }, detail: { en: "Carlos · 5-star link", pt: "Carlos · link 5 estrelas", es: "Carlos · enlace 5 estrellas", hi: "कार्लोस · 5-स्टार लिंक" } },
  { icon: "🎯", label: { en: "Lead captured", pt: "Lead capturado", es: "Lead capturado", hi: "लीड कैप्चर" }, detail: { en: "New patient · insurance ✓", pt: "Paciente novo · convênio ✓", es: "Paciente nuevo · seguro ✓", hi: "नया मरीज़ · बीमा ✓" } },
  { icon: "↩️", label: { en: "Follow-up sent", pt: "Retorno enviado", es: "Seguimiento enviado", hi: "फ़ॉलो-अप भेजा" }, detail: { en: "No-show → rebooked", pt: "Faltou → remarcado", es: "Faltó → reagendado", hi: "नो-शो → फिर बुक" } },
  { icon: "💬", label: { en: "Replied on WhatsApp", pt: "Respondeu no WhatsApp", es: "Respondió en WhatsApp", hi: "WhatsApp पर जवाब" }, detail: { en: "Spanish · instant", pt: "Espanhol · na hora", es: "Español · al instante", hi: "स्पेनिश · तुरंत" } },
  { icon: "🛒", label: { en: "Order placed", pt: "Pedido feito", es: "Pedido hecho", hi: "ऑर्डर हुआ" }, detail: { en: "2× Large · pickup 7:15", pt: "2× grande · retirada 19:15", es: "2× grande · recoger 19:15", hi: "2× लार्ज · पिकअप 7:15" } },
  { icon: "🔗", label: { en: "Payment link · paid", pt: "Link de pagamento · pago", es: "Enlace de pago · pagado", hi: "पेमेंट लिंक · भुगतान" }, detail: { en: "$120 · cleared", pt: "US$ 120 · compensado", es: "$120 · acreditado", hi: "$120 · क्लियर" } },
  { icon: "📞", label: { en: "Callback set", pt: "Retorno agendado", es: "Devolución agendada", hi: "कॉलबैक तय" }, detail: { en: "Tomorrow 10:00 AM", pt: "Amanhã às 10:00", es: "Mañana 10:00", hi: "कल 10:00 AM" } },
  { icon: "🔁", label: { en: "Rescheduled", pt: "Remarcado", es: "Reagendado", hi: "फिर से तय" }, detail: { en: "João · Fri 2:00 PM", pt: "João · sex 14:00", es: "João · vie 14:00", hi: "जोआओ · शुक्र 2:00 PM" } },
  { icon: "📋", label: { en: "Intake completed", pt: "Cadastro concluído", es: "Registro completado", hi: "इनटेक पूरा" }, detail: { en: "New client form", pt: "Ficha de cliente novo", es: "Ficha de cliente nuevo", hi: "नए क्लाइंट का फ़ॉर्म" } },
  { icon: "📣", label: { en: "Ad campaign live", pt: "Campanha no ar", es: "Campaña en marcha", hi: "कैंपेन लाइव" }, detail: { en: "Google · 14 clicks today", pt: "Google · 14 cliques hoje", es: "Google · 14 clics hoy", hi: "Google · आज 14 क्लिक" } },
  { icon: "⚡", label: { en: "Ad lead → called", pt: "Lead do anúncio → ligou", es: "Lead del anuncio → llamó", hi: "विज्ञापन लीड → कॉल" }, detail: { en: "54 seconds after the click", pt: "54 segundos após o clique", es: "54 segundos tras el clic", hi: "क्लिक के 54 सेकंड बाद" } },
  { icon: "🎬", label: { en: "Post published", pt: "Post publicado", es: "Post publicado", hi: "पोस्ट प्रकाशित" }, detail: { en: "4 this week · your voice", pt: "4 esta semana · sua voz", es: "4 esta semana · tu voz", hi: "इस हफ़्ते 4 · आपकी आवाज़" } },
  { icon: "🖥️", label: { en: "Website shipped", pt: "Site entregue", es: "Web entregada", hi: "वेबसाइट डिलीवर" }, detail: { en: "Gui lives inside it", pt: "com a Gui morando dentro", es: "con Gui viviendo dentro", hi: "गुई उसी में रहती है" } },
  { icon: "📱", label: { en: "App on the stores", pt: "App nas lojas", es: "App en las tiendas", hi: "ऐप स्टोर पर" }, detail: { en: "iOS + Android · live", pt: "iOS + Android · no ar", es: "iOS + Android · en vivo", hi: "iOS + Android · लाइव" } },
];

// Every kind of work Gui does — inbound & outbound, confirmations, sales, support, tracking…
// CADA CENÁRIO É UMA HISTÓRIA LEGÍVEL (Luis, 2026-09-09: «olhando o iPhone não dá pra entender
// o que a Gui realmente faz»). Antes: um negócio, uma frase solta. Agora: QUEM ligou e o que
// pediu → o que a Gui FEZ (ferramenta nomeada) → o RESULTADO em dinheiro/agenda. É um recibo,
// não um painel: a pessoa lê "pediu X, a Gui fez Y, saiu Z" em três segundos.
// (Luis, 2026-09-09) — e em QUATRO idiomas: a lei da casa é nada de EN em tela PT. Cada campo
// lido pelo visitante é {en,pt,es,hi}; `loc()` escolhe. Nome do negócio fica (é nome próprio).
const T = (en, pt, es, hi) => ({ en, pt, es, hi });
const SCENARIOS = [
  { biz: "Tony's Pizza", dir: "in", type: T("Order","Pedido","Pedido","ऑर्डर"),
    who: T("Marco · new customer","Marco · cliente novo","Marco · cliente nuevo","Marco · नया ग्राहक"), ask: T("Two larges for pickup","Duas grandes pra retirar","Dos grandes para recoger","पिकअप के लिए दो बड़े"),
    line: T("“Two larges, extra cheese — pickup at 7:15. Want drinks with that?”","“Duas grandes, queijo extra — retirada às 19:15. Quer bebida junto?”","“Dos grandes, extra queso — recoger a las 7:15. ¿Quieres bebidas?”","“दो बड़े, एक्स्ट्रा चीज़ — 7:15 पर पिकअप। साथ में ड्रिंक चाहिए?”"),
    did: [T("Took the order","Anotou o pedido","Tomó el pedido","ऑर्डर लिया"), T("Upsold 2 drinks","Vendeu 2 bebidas a mais","Sumó 2 bebidas","2 ड्रिंक अपसेल"), T("Charged card on file","Cobrou no cartão salvo","Cobró a la tarjeta guardada","सेव्ड कार्ड से चार्ज")],
    got: T("$41.80 · paid · ready 7:15","$41,80 · pago · pronto 19:15","$41.80 · pagado · listo 7:15","$41.80 · भुगतान · 7:15 तैयार") },
  { biz: "Bright Smiles Dental", dir: "out", type: T("Confirmation","Confirmação","Confirmación","पुष्टि"),
    who: T("Ana · patient","Ana · paciente","Ana · paciente","Ana · मरीज़"), ask: T("Cleaning tomorrow 9 AM","Limpeza amanhã às 9h","Limpieza mañana 9 AM","कल सुबह 9 बजे क्लीनिंग"),
    line: T("“Hi! Confirming your cleaning tomorrow at 9 AM — reply 1 to keep, 2 to move.”","“Oi! Confirmando sua limpeza amanhã às 9h — responda 1 pra manter, 2 pra remarcar.”","“¡Hola! Confirmo tu limpieza mañana a las 9 AM — responde 1 para mantener, 2 para mover.”","“नमस्ते! कल सुबह 9 बजे की क्लीनिंग कन्फ़र्म — 1 रखने के लिए, 2 बदलने के लिए।”"),
    did: [T("Called 24h before","Ligou 24h antes","Llamó 24h antes","24 घंटे पहले कॉल"), T("Confirmed the slot","Confirmou o horário","Confirmó el turno","स्लॉट कन्फ़र्म"), T("Updated the calendar","Atualizou a agenda","Actualizó la agenda","कैलेंडर अपडेट")],
    got: T("No-show avoided · $180 kept","Falta evitada · $180 garantidos","Ausencia evitada · $180 asegurados","नो-शो टला · $180 बचे") },
  { biz: "Glow Spa", dir: "in", type: T("Booking","Agendamento","Reserva","बुकिंग"),
    who: T("Priya · returning","Priya · cliente de volta","Priya · vuelve","Priya · दोबारा आई"), ask: T("Facial on Friday","Limpeza de pele na sexta","Facial el viernes","शुक्रवार फ़ेशियल"),
    line: T("“Friday at 4 works — I sent your deposit link. You're all set ✨”","“Sexta às 16h fecha — mandei o link do sinal. Tudo certo ✨”","“Viernes a las 4 va — te envié el link del depósito. Todo listo ✨”","“शुक्रवार 4 बजे ठीक है — डिपॉज़िट लिंक भेज दिया। सब सेट ✨”"),
    did: [T("Found the opening","Achou a vaga","Encontró el hueco","खाली स्लॉट ढूँढा"), T("Booked Fri 4 PM","Marcou sex 16h","Reservó vie 4 PM","शुक्र 4 PM बुक"), T("Sent deposit link","Enviou link do sinal","Envió link de depósito","डिपॉज़िट लिंक भेजा")],
    got: T("$50 deposit · booked","$50 de sinal · marcado","$50 de depósito · reservado","$50 डिपॉज़िट · बुक") },
  { biz: "Vértice Imóveis", dir: "in", type: T("Lead qualify","Qualificação","Calificación","लीड क्वालिफ़ाई"),
    who: T("Rafael · lead from ad","Rafael · lead do anúncio","Rafael · lead del anuncio","Rafael · विज्ञापन से लीड"), ask: T("3-bed downtown under R$2k","3 quartos no centro até R$2 mil","3 hab. en el centro < R$2k","सेंटर में 3-बेड, R$2k से कम"),
    line: T("“3-bed downtown under R$2k? I'll text you 4 matches tonight.”","“3 quartos no centro até R$2 mil? Te mando 4 opções hoje à noite.”","“¿3 hab. en el centro por menos de R$2k? Te envío 4 opciones esta noche.”","“सेंटर में 3-बेड, R$2k से कम? आज रात 4 विकल्प भेजती हूँ।”"),
    did: [T("Qualified budget & area","Qualificou orçamento e região","Calificó presupuesto y zona","बजट-इलाका क्वालिफ़ाई"), T("Saved to CRM","Salvou no CRM","Guardó en el CRM","CRM में सेव"), T("Scheduled a visit","Marcou visita","Agendó una visita","विज़िट तय")],
    got: T("Visit Sat 10 AM · lead owned","Visita sáb 10h · lead seu","Visita sáb 10 AM · lead tuyo","शनि 10 AM विज़िट · लीड आपकी") },
  { biz: "Apex Plumbing", dir: "out", type: T("Sales","Venda","Venta","सेल्स"),
    who: T("Mrs. Chen · client since 2024","Sra. Chen · cliente desde 2024","Sra. Chen · cliente desde 2024","श्रीमती Chen · 2024 से ग्राहक"), ask: T("Water heater service due","Revisão do aquecedor vencendo","Servicio del calentador vencido","वॉटर हीटर सर्विस ड्यू"),
    line: T("“Your water heater's due for service — I've got Thursday 10 AM. Book it?”","“Seu aquecedor está na hora da revisão — tenho quinta às 10h. Marco?”","“Tu calentador necesita servicio — tengo jueves 10 AM. ¿Lo agendo?”","“आपके वॉटर हीटर की सर्विस ड्यू है — गुरुवार 10 AM खाली है। बुक करूँ?”"),
    did: [T("Spotted the due date","Viu a data vencendo","Detectó el vencimiento","ड्यू डेट पकड़ी"), T("Called first","Ligou antes","Llamó primero","पहले कॉल किया"), T("Booked Thu 10 AM","Marcou qui 10h","Reservó jue 10 AM","गुरु 10 AM बुक")],
    got: T("$320 job · from your own list","$320 de serviço · da sua própria lista","$320 de trabajo · de tu propia lista","$320 का काम · आपकी अपनी लिस्ट से") },
  { biz: "Luna Café", dir: "in", type: T("Support","Suporte","Soporte","सपोर्ट"),
    who: T("Sofia · regular","Sofia · cliente habitual","Sofía · habitual","Sofia · रेगुलर"), ask: T("Double charge on receipt","Cobrança em dobro","Cobro duplicado","दो बार चार्ज"),
    line: T("“I see the charge — refunding $20 now. You'll get a text confirmation.”","“Estou vendo a cobrança — estornando $20 agora. Você recebe a confirmação por SMS.”","“Veo el cobro — devuelvo $20 ahora. Recibirás confirmación por SMS.”","“चार्ज दिख रहा है — $20 अभी रिफ़ंड। SMS से पुष्टि मिलेगी।”"),
    did: [T("Checked the receipt","Conferiu o recibo","Revisó el recibo","रसीद जाँची"), T("Refunded $20","Estornou $20","Devolvió $20","$20 रिफ़ंड"), T("Texted confirmation","Confirmou por SMS","Confirmó por SMS","SMS से पुष्टि")],
    got: T("Regular kept · 5★ review asked","Cliente mantida · pediu avaliação 5★","Cliente retenida · pidió reseña 5★","ग्राहक बची · 5★ रिव्यू माँगा") },
  { biz: "FitZone Gym", dir: "out", type: T("Win-back","Reativação","Reactivación","वापसी"),
    who: T("Diego · lapsed 60 days","Diego · sumido há 60 dias","Diego · 60 días sin venir","Diego · 60 दिन से गायब"), ask: T("Stopped coming","Parou de vir","Dejó de venir","आना बंद"),
    line: T("“We miss you! 1 month free if you're back this week — want me to set it up?”","“Sentimos sua falta! 1 mês grátis se voltar esta semana — quer que eu ative?”","“¡Te extrañamos! 1 mes gratis si vuelves esta semana — ¿lo activo?”","“आपकी कमी है! इस हफ़्ते लौटें तो 1 महीना फ़्री — सेट कर दूँ?”"),
    did: [T("Detected the churn","Detectou o sumiço","Detectó el abandono","चर्न पकड़ा"), T("Offered win-back","Ofereceu volta","Ofreció regreso","वापसी ऑफ़र"), T("Reactivated plan","Reativou o plano","Reactivó el plan","प्लान फिर चालू")],
    got: T("$79/mo back · member returned","$79/mês de volta · aluno voltou","$79/mes de vuelta · socio regresó","$79/माह वापस · सदस्य लौटा") },
  { biz: "Drive Auto", dir: "in", type: T("Quote","Orçamento","Presupuesto","कोटेशन"),
    who: T("Luis · from Google","Luis · veio do Google","Luis · desde Google","Luis · Google से"), ask: T("Brake job price","Preço do freio","Precio de frenos","ब्रेक का दाम"),
    line: T("“Brake job is $280 out the door — I can fit you in tomorrow at 8. Sound good?”","“Freio sai por $280 fechado — consigo amanhã às 8h. Pode ser?”","“Los frenos salen $280 todo incluido — te puedo atender mañana a las 8. ¿Va?”","“ब्रेक का काम $280 फ़ाइनल — कल 8 बजे फ़िट कर सकती हूँ। ठीक?”"),
    did: [T("Quoted from your price list","Orçou pela sua tabela","Cotizó con tu lista","आपकी प्राइस लिस्ट से कोट"), T("Booked tomorrow 8 AM","Marcou amanhã 8h","Reservó mañana 8 AM","कल 8 AM बुक"), T("Sent the quote by SMS","Mandou o orçamento por SMS","Envió el presupuesto por SMS","SMS से कोट भेजा")],
    got: T("$280 · quoted & booked","$280 · orçado e marcado","$280 · cotizado y reservado","$280 · कोट और बुक") },
  { biz: "Sterling Law", dir: "in", type: T("Intake","Triagem","Admisión","इनटेक"),
    who: T("Karen · new case","Karen · caso novo","Karen · caso nuevo","Karen · नया केस"), ask: T("Contract dispute","Disputa de contrato","Disputa contractual","कॉन्ट्रैक्ट विवाद"),
    line: T("“Got your case details — a paralegal will call you within the hour.”","“Anotei os detalhes do caso — um assistente jurídico te liga em até 1 hora.”","“Tengo los detalles del caso — un paralegal te llama dentro de una hora.”","“केस की जानकारी मिल गई — एक पैरालीगल एक घंटे में कॉल करेगा।”"),
    did: [T("Ran the intake","Fez a triagem","Hizo la admisión","इनटेक किया"), T("Flagged as priority","Marcou como prioridade","Marcó como prioridad","प्राथमिकता चिह्नित"), T("Routed to a paralegal","Encaminhou ao assistente","Derivó a un paralegal","पैरालीगल को भेजा")],
    got: T("Case opened · handoff in 1h","Caso aberto · repasse em 1h","Caso abierto · traspaso en 1h","केस खुला · 1 घंटे में हैंडऑफ़") },
  { biz: "Bella Hair", dir: "out", type: T("Reminder","Lembrete","Recordatorio","रिमाइंडर"),
    who: T("Júlia · color appt","Júlia · horário de coloração","Julia · cita de color","Júlia · कलर अपॉइंटमेंट"), ask: T("Appointment in 1 hour","Horário em 1 hora","Cita en 1 hora","1 घंटे में अपॉइंटमेंट"),
    line: T("“Reminder: your color appointment is in 1 hour. See you soon!”","“Lembrete: sua coloração é daqui a 1 hora. Até já!”","“Recordatorio: tu cita de color es en 1 hora. ¡Nos vemos!”","“रिमाइंडर: आपका कलर अपॉइंटमेंट 1 घंटे में है। मिलते हैं!”"),
    did: [T("Sent the reminder","Mandou o lembrete","Envió el recordatorio","रिमाइंडर भेजा"), T("Confirmed arrival","Confirmou presença","Confirmó asistencia","आना कन्फ़र्म"), T("Prepped the chair","Deixou a cadeira pronta","Preparó la silla","कुर्सी तैयार")],
    got: T("$140 slot · on time","$140 no horário · em dia","$140 de turno · a tiempo","$140 स्लॉट · समय पर") },
];

// floating stat cards — short, high-visibility copy → localized per visitor language ({en,pt,es,hi})
const FLOAT_L = [
  { icon: "🌙", a: { en: "Captured at 2:14 AM", pt: "Capturado às 2h14", es: "Capturado a las 2:14 AM", hi: "रात 2:14 पर कैप्चर" }, b: { en: "while you slept", pt: "enquanto você dormia", es: "mientras dormías", hi: "जब आप सो रहे थे" } },
  { icon: "🌐", a: { en: "Replied in Español", pt: "Respondeu em Español", es: "Respondió en Español", hi: "Español में जवाब दिया" }, b: { en: "in 2 seconds", pt: "em 2 segundos", es: "en 2 segundos", hi: "2 सेकंड में" } },
  { icon: "📞", a: { en: "17 calls answered", pt: "17 ligações atendidas", es: "17 llamadas contestadas", hi: "17 कॉल के जवाब" }, b: { en: "0 missed today", pt: "0 perdidas hoje", es: "0 perdidas hoy", hi: "आज 0 छूटीं" } },
  { icon: "⚡", a: { en: "Quote sent", pt: "Orçamento enviado", es: "Cotización enviada", hi: "कोटेशन भेजा" }, b: { en: "in 11 seconds", pt: "em 11 segundos", es: "en 11 segundos", hi: "11 सेकंड में" } },
  { icon: "🗓️", a: { en: "Booked solid", pt: "Agenda lotada", es: "Agenda llena", hi: "बुकिंग फुल" }, b: { en: "next 3 days", pt: "próximos 3 dias", es: "próximos 3 días", hi: "अगले 3 दिन" } },
];
const FLOAT_R = [
  { icon: "📈", a: { en: "+37% bookings", pt: "+37% agendamentos", es: "+37% reservas", hi: "+37% बुकिंग" }, b: { en: "this month, on autopilot", pt: "este mês, no automático", es: "este mes, en automático", hi: "इस महीने, ऑटोपायलट पर" } },
  { icon: "💰", a: { en: "$1,840 collected", pt: "$1.840 recebidos", es: "$1,840 cobrados", hi: "$1,840 वसूले" }, b: { en: "today · hands-off", pt: "hoje · sem esforço", es: "hoy · sin esfuerzo", hi: "आज · बिना मेहनत" } },
  { icon: "🎯", a: { en: "28 leads captured", pt: "28 leads capturados", es: "28 leads capturados", hi: "28 लीड कैप्चर" }, b: { en: "this week", pt: "esta semana", es: "esta semana", hi: "इस हफ़्ते" } },
  { icon: "⏱️", a: { en: "9 hours saved", pt: "9 horas economizadas", es: "9 horas ahorradas", hi: "9 घंटे बचाए" }, b: { en: "every week", pt: "toda semana", es: "cada semana", hi: "हर हफ़्ते" } },
  { icon: "🧾", a: { en: "$4,200 quoted", pt: "$4.200 orçados", es: "$4,200 cotizados", hi: "$4,200 के कोट" }, b: { en: "today", pt: "hoje", es: "hoy", hi: "आज" } },
  { icon: "⭐", a: { en: "23 reviews", pt: "23 avaliações", es: "23 reseñas", hi: "23 समीक्षाएँ" }, b: { en: "5-star links sent", pt: "links 5 estrelas enviados", es: "enlaces 5 estrellas enviados", hi: "5-स्टार लिंक भेजे" } },
];

function Waveform() {
  const bars = Array.from({ length: 26 });
  return (
    <div className="flex items-end gap-[3px] h-10">
      {bars.map((_, i) => (
        <span key={i} className="w-[3px] rounded-full bg-gradient-to-t from-g-green to-g-gold origin-bottom"
          style={{ height: `${28 + ((i * 41) % 64)}%`, animation: `gwave 1.4s ease-in-out ${(i % 8) * 0.1}s infinite` }} />
      ))}
    </div>
  );
}

const txt = (v, lang) => (typeof v === "string" ? v : (v && (v[lang] || v.en)) || "");

function FeedRow({ a, lang }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.05] px-3 py-2.5 ring-1 ring-white/10">
      <span className="text-base">{a.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold text-white">{txt(a.label, lang)}</div>
        <div className="truncate text-[11px] text-white/70">{txt(a.detail, lang)}</div>
      </div>
      <span className="text-[11px] text-g-green">✓</span>
    </div>
  );
}

// `export` (2026-09-09): a nova landing (/nova) reaproveita o MESMO objeto vivo — um segundo
// mockup seria uma segunda verdade sobre a Gui para manter em dia.
// OS KEYFRAMES DO HERO, EXPORTADOS (2026-09-09). O `Phone` sozinho é um boneco: gfloat/gplant/
// gscroll/greveal/gshine/gembers moravam só neste <style>, e a landing nova importou o Phone sem
// eles — telefone parado, título sem brilho. Quem monta o Phone fora daqui monta isto junto.
export function HeroKeyframes() {
  return (
    <style>{`
        @keyframes gwave{0%,100%{transform:scaleY(0.42)}50%{transform:scaleY(1)}}
        @keyframes gscroll{from{transform:translateY(0)}to{transform:translateY(-50%)}}
        @keyframes gsoft{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        /* faster, translate-free crossfade for the floating proof cards so the pill never reads empty mid-swap */
        @keyframes gswap{from{opacity:.15}to{opacity:1}}
        @keyframes gfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        @keyframes gplant{0%,100%{transform:translateY(0) rotate(-.8deg)}50%{transform:translateY(-7px) rotate(.8deg)}}
        @keyframes gpulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.45);opacity:0}}
        @keyframes greveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gshine{to{background-position:220% center}}
        @keyframes gembers{0%,100%{opacity:.55}50%{opacity:.95}}
        @media (prefers-reduced-motion: reduce){
          *{animation-duration:0.001ms !important;animation-iteration-count:1 !important}
        }
    `}</style>
  );
}

export function Phone() {
  const { lang } = useLang();
  const loc = (v) => v[lang] ?? v.en; // {en,pt,es,hi} → visitor language
  const [secs, setSecs] = useState(134);
  const [biz, setBiz] = useState(0);
  const [stat, setStat] = useState(0);

  useEffect(() => {
    const a = setInterval(() => setSecs((s) => s + 1), 1000);
    const b = setInterval(() => setBiz((s) => s + 1), 6500); // história inteira precisa de tempo pra ser lida
    const c = setInterval(() => setStat((s) => s + 1), 3200); // floating cards rotation
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); };
  }, []);

  const B = SCENARIOS[biz % SCENARIOS.length];
  const dirLabel = B.dir === "in" ? "Inbound" : "Outbound";
  const dirIcon = B.dir === "in" ? "↘" : "↗";
  const L = FLOAT_L[stat % FLOAT_L.length];
  const R = FLOAT_R[(stat + 2) % FLOAT_R.length];
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="relative mx-auto w-[360px] max-w-full">
      <div className="pointer-events-none absolute -inset-12 bg-[radial-gradient(closest-side,rgba(62,148,104,0.22),transparent)] blur-2xl" />
      {/* Gui's warm signature glow hugging the live device */}
      <div className="pointer-events-none absolute -inset-10 bg-[radial-gradient(closest-side,rgba(255,138,51,0.16),transparent)] blur-2xl" style={{ animation: "gembers 6s ease-in-out infinite" }} />

      {/* A MARCA no lugar do aparelho. Saíram as três coisas que faziam disto um telefone —
          a moldura de alumínio, o entalhe e a barra "9:41 ▮▮▮ 100%" — e ficou TUDO o que ele
          fazia: a ligação ao vivo, a fala da Gui, o mural do que ela está resolvendo e os
          cartões flutuantes. Mesma função, outra identidade.
          POR QUÊ: um telefone desenhado diz "isto é um aplicativo", e a Guileo não vende
          aplicativo — vende resultado que se acumula. A marca diz isso sozinha: folhas em
          cima, raízes de CIRCUITO embaixo. E é a única imagem deste mercado que ninguém
          copia sem virar cópia declarada. */}
      {/* APARELHO DE VERDADE (Luis, 2026-09-10: "dá pra melhorar o realismo na tela também?"):
          moldura de titânio com a luz caindo de cima (clara em cima, escura embaixo), aro interno
          preto (a espessura do vidro), botões laterais, a ilha da câmera, e a TELA emitindo luz —
          um halo verde-cimento vazando pelas bordas pro fundo. O reflexo diagonal do ambiente
          atravessa a tela por cima de tudo (z-20), como vidro real. */}
      <div className="relative rounded-[2.6rem] p-[3px] shadow-[0_60px_150px_-30px_rgba(0,0,0,0.95),0_0_80px_-20px_rgba(62,148,104,0.35)]"
           style={{ background: "linear-gradient(180deg,#6a6560 0%,#3a3733 18%,#232120 55%,#15140f 100%)" }}>
        {/* botões laterais */}
        <span aria-hidden="true" className="absolute -left-[3px] top-[110px] h-[26px] w-[3px] rounded-l-sm" style={{ background: "linear-gradient(180deg,#5a5652,#2a2826)" }} />
        <span aria-hidden="true" className="absolute -left-[3px] top-[160px] h-[48px] w-[3px] rounded-l-sm" style={{ background: "linear-gradient(180deg,#5a5652,#2a2826)" }} />
        <span aria-hidden="true" className="absolute -left-[3px] top-[218px] h-[48px] w-[3px] rounded-l-sm" style={{ background: "linear-gradient(180deg,#5a5652,#2a2826)" }} />
        <span aria-hidden="true" className="absolute -right-[3px] top-[180px] h-[70px] w-[3px] rounded-r-sm" style={{ background: "linear-gradient(180deg,#5a5652,#2a2826)" }} />
        <div className="relative rounded-[2.45rem] bg-black p-[6px]">
          <div className="relative overflow-hidden rounded-[2.1rem] bg-[#0b0b0b]/90 backdrop-blur-xl" style={{ boxShadow: "inset 0 0 40px rgba(62,148,104,0.10)" }}>
            {/* ilha da câmera */}
            <span aria-hidden="true" className="absolute left-1/2 top-3 z-30 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-black ring-1 ring-white/[0.06]"><span className="absolute right-2 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#1a1f24] ring-1 ring-white/10" /></span>
            {/* reflexo do ambiente atravessando a tela — vidro real */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-20" style={{ background: "linear-gradient(112deg, transparent 30%, rgba(255,255,255,0.075) 42%, rgba(255,255,255,0.02) 48%, transparent 58%)" }} />
            {/* OLED não é uniforme: brilho leve caindo de cima */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.05), transparent 30%, rgba(0,0,0,0.18) 100%)" }} />
        <div className="relative">

          {/* a logo real, grande, respirando — o objeto central da dobra */}
          <div className="flex justify-center pt-7 pb-1">
            <img src={mark} alt="Guileo" width="1200" height="1200"
                 className="h-[88px] w-[88px] object-contain drop-shadow-[0_18px_38px_rgba(0,0,0,0.5)]"
                 style={{ animation: "gplant 8s ease-in-out infinite" }} />
          </div>

          <div className="px-6 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-g-green">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" />
                </span>
                On a call · {mm}:{ss}
              </div>
              <span key={"t" + biz} className="rounded-full bg-white/[0.06] px-2 py-[2px] text-[9px] font-bold uppercase tracking-wider text-white/70 ring-1 ring-white/10" style={{ animation: "gsoft .8s ease-in-out both" }}>
                {dirIcon} {dirLabel} · {loc(B.type)}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              {/* O avatar redondo saiu: a logo GRANDE já está acima, e repetir a mesma marca
                  a 14px logo abaixo dela só rouba atenção dela mesma. Fica o microfone —
                  ele não é enfeite, é a informação de que isto é VOZ ao vivo, não chat. */}
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-g-green/25 to-g-gold/15 text-g-green ring-1 ring-g-green/40">
                <span className="absolute inset-0 rounded-full ring-2 ring-g-green/35" style={{ animation: "gpulse 2s ease-out infinite" }} />
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </span>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-[16px] font-bold text-white">Gui</span>
                  <span className="rounded-full px-1.5 py-[1px] text-[8px] font-black uppercase tracking-wider" style={{ color: "#FF8A33", border: "1px solid rgba(255,138,51,0.45)", background: "rgba(255,138,51,0.12)" }}>AI Voice</span>
                </div>
                <div key={B.biz} className="text-[11px] text-white/55" style={{ animation: "gsoft .8s ease-in-out both" }}>answering for {B.biz}</div>
              </div>
            </div>
          </div>

          <div className="relative mx-6 mt-4 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10 backdrop-blur-md">
            {/* QUEM LIGOU E O QUE PEDIU — a primeira linha que o olho lê */}
            <div key={"w" + biz} className="flex items-center justify-between gap-2" style={{ animation: "gswap .5s ease-in-out both" }}>
              <span className="truncate text-[10.5px] font-bold text-white/85">{loc(B.who)}</span>
              <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-[2px] text-[9px] font-semibold text-white/60 ring-1 ring-white/10">{loc(B.ask)}</span>
            </div>
            <div className="mt-2"><Waveform /></div>
            <p key={B.line} className="mt-2 text-[12.5px] leading-snug text-white/80" style={{ animation: "gsoft .8s ease-in-out both" }}>{loc(B.line)}</p>
            {/* O QUE A GUI FEZ → O QUE SAIU. Ferramenta nomeada e recibo: é isto que "inteligente" quer dizer. */}
            <div key={"d" + biz} className="mt-3 border-t border-white/[0.07] pt-2.5" style={{ animation: "gswap .5s ease-in-out both" }}>
              <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">{loc({ en: "Gui did", pt: "A Gui fez", es: "Gui hizo", hi: "Gui ने किया" })}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {B.did.map((d, k) => (
                  <span key={k} className="rounded-full border border-g-green/30 bg-g-green/10 px-2 py-[3px] text-[10px] font-semibold text-g-light" style={{ animation: `gswap .5s ease-in-out ${k * 0.08}s both` }}>✓ {loc(d)}</span>
                ))}
              </div>
              <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-black/30 px-2.5 py-2 ring-1 ring-white/[0.06]">
                <span className="text-[11px]">🧾</span>
                <span className="text-[11.5px] font-black tracking-tight text-g-gold">{loc(B.got)}</span>
              </div>
            </div>
          </div>

          {/* SMOOTH continuous feed — glides up forever, soft fade at edges */}
          <div className="px-6 pb-4 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Gui is handling it · live</span>
              <span className="text-[9px] text-g-green">● real-time</span>
            </div>
            <div className="relative h-[132px] overflow-hidden" style={{ maskImage: "linear-gradient(to bottom,transparent,#000 14%,#000 86%,transparent)", WebkitMaskImage: "linear-gradient(to bottom,transparent,#000 14%,#000 86%,transparent)" }}>
              <div className="space-y-2" style={{ animation: "gscroll 30s linear infinite" }}>
                {[...POOL, ...POOL].map((a, i) => <FeedRow key={i} a={a} lang={lang} />)}
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>

      {/* floating proof cards — rotate (services + profit + numbers), soft crossfade + float
          ENQUADRAMENTO: a posição negativa move a ORIGEM, não empurra pra fora — quem decide
          se o cartão sai do card é a LARGURA. Em -left-20 (−80px) com 170px de largura, a borda
          direita caía em +90px e o cartão cobria "ON A CALL · 10:34". Agora: 156px de largura em
          -left-[136px] → sobra só 20px de encaixe na quina arredondada, que é proposital (dá a
          sensação de camada), e o cabeçalho fica livre. As alturas também mudaram para os VÃOS:
          o da esquerda ao lado da onda sonora, o da direita no meio do mural. */}
      <div className="absolute -left-[136px] top-[208px] hidden w-[156px] rounded-2xl border border-white/10 bg-[#14130F]/90 px-3 py-2 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] backdrop-blur-xl lg:block" style={{ animation: "gfloat 6s ease-in-out infinite" }}>
        <div key={"l" + stat} style={{ animation: "gswap .45s ease-out both" }}>
          <div className="text-[11px] font-bold text-g-word">{L.icon} {loc(L.a)}</div>
          <div className="text-[10px] text-g-ink">{loc(L.b)}</div>
        </div>
      </div>
      <div className="absolute -right-[136px] bottom-[168px] hidden w-[156px] rounded-2xl border border-white/10 bg-[#14130F]/90 px-3 py-2 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] backdrop-blur-xl lg:block" style={{ animation: "gfloat 7s ease-in-out 1s infinite" }}>
        <div key={"r" + stat} style={{ animation: "gswap .45s ease-out both" }}>
          <div className="text-[11px] font-bold text-g-word">{R.icon} {loc(R.a)}</div>
          <div className="text-[10px] text-g-ink">{loc(R.b)}</div>
        </div>
      </div>
    </div>
  );
}

export default function HeroV2() {
  const { t, lang } = useLang();
  const H = t.hero || {};
  const C = HERO_COPY[lang] || HERO_COPY.en;
  return (
    <section className="relative overflow-hidden px-5 pt-10 pb-20 sm:pt-16">
      <HeroKeyframes />

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_500px_at_70%_-10%,rgba(62,148,104,0.10),transparent),radial-gradient(800px_400px_at_10%_20%,rgba(214,194,154,0.06),transparent)]" />
      {/* Gui signature ember — the AI's warm orange presence breathing behind the scene (Faena drama) */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(620px_420px_at_62%_42%,rgba(255,138,51,0.09),transparent)]" style={{ animation: "gembers 7s ease-in-out infinite" }} />

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-g-gold">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#FF8A33", boxShadow: "0 0 10px 1px rgba(255,138,51,0.85)" }} /> {C.eyebrow}
          </div>

          {/* ⚠️ AS DESCENDENTES ESTAVAM SENDO CORTADAS (Luis, 2026-08-17: "essa parte do You Grow
              tá cortado"). O "g" de "grow" e o "y" de "You" perdiam a perna.
              CAUSA, e são DUAS coisas somadas:
                1. `leading-[0.92]` — entrelinha MENOR que 1 aperta a caixa da linha a ponto de ela
                   ficar mais curta que o glifo. Em 4.5rem isso é uma faixa de vários pixels.
                2. `bg-clip-text` + `text-transparent` — o gradiente é pintado DENTRO do recorte do
                   texto, e esse recorte respeita a caixa da linha, não o desenho da letra. Sem o
                   clip o corte só apareceria no overflow; com ele, a perna do "g" simplesmente não
                   é pintada. Por isso a 3ª linha (dourada, com "g" e "y") era a mais visível.
              CONSERTO SEM MEXER NO ESPAÇAMENTO: `pb-[0.14em]` dá altura pro glifo respirar e
              `-mb-[0.14em]` devolve exatamente o mesmo espaço — o texto ganha ar de desenho e a
              composição fica idêntica à que o Luis aprovou. Nada de afrouxar a entrelinha: era ela
              que dava a força do título. */}
          <h1 className="mt-5 font-black leading-[0.92] tracking-tight" style={{ fontSize: "clamp(2.3rem,8.5vw,4.5rem)" }}>
            <span className="block pb-[0.14em] -mb-[0.14em] text-g-word" style={{ animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{C.h1[0]}</span>
            <span className="block bg-gradient-to-r from-g-green via-g-light to-g-green bg-clip-text pb-[0.14em] -mb-[0.14em] pl-[0.12em] text-transparent" style={{ backgroundSize: "220% auto", animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .2s both, gshine 7s linear infinite" }}>{C.h1[1]}</span>
            <span className="block bg-gradient-to-r from-g-gold via-g-copper to-g-gold bg-clip-text pb-[0.14em] -mb-[0.14em] pl-[0.24em] text-transparent" style={{ backgroundSize: "220% auto", animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .35s both, gshine 7s linear .6s infinite" }}>{C.h1[2]}</span>
          </h1>

          {/* ── A PONTE (2026-08-17, pedido do Luis: «podia voltar as 2 frases Work Smart Grow Faster
              Sleep Better e aí embaixo escrito isso») ─────────────────────────────────────────────
              O título voltou a ser a PROMESSA AO DONO — o que ele ganha na própria vida (trabalhar
              com inteligência, crescer, dormir). Isso é o que vende para quem está exausto de
              atender telefone, e é a frase que a marca já assinava (o rodapé PT sempre terminou
              assim). Só que ela é emocional: sozinha, não diz o que a empresa FAZ.
              Então "A gente traz os clientes. A AI atende, agenda e vende. Você cresce." desce um
              degrau e vira a ponte — o modelo de negócio inteiro em três orações curtas, ligando a
              promessa emocional lá em cima ao parágrafo concreto logo abaixo.
              A escala desce de verdade: 4.5rem → 1.3rem → 1.03rem. Três tamanhos, três funções —
              sentir, entender, decidir. Era esse degrau do meio que faltava quando os quatro
              blocos brigavam com o mesmo peso. */}
          <p className="mt-4 max-w-[32rem] text-[clamp(1.05rem,1.5vw,1.3rem)] font-semibold leading-snug tracking-tight text-g-word"
             style={{ animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .5s both" }}>
            {C.promessa}
          </p>

          {/* ── A TROCA (2026-08-17, Luis) ──────────────────────────────────────────────────────
              Não era remoção, era TROCA: o trio Brain·AD·Build subiu para o rótulo fixo da listra
              de serviços (onde ele é a legenda de uma faixa já agrupada por pilar), e a frase que
              morava lá desceu para cá, no lugar exato dele.
              Ela funciona melhor aqui do que lá: acima de uma faixa de nomes de serviço, "tudo o
              que a gente constrói e opera pra você" era a legenda óbvia da própria lista; no herói,
              logo antes do botão, ela responde a pergunta que sobra depois do título — "isso é só
              o telefone, ou é a operação inteira?". */}
          <p className="mt-6 text-[11.5px] font-black uppercase tracking-[0.16em] text-g-gold/80">
            {C.tudo}
          </p>

          {/* AÇÃO — a linha de apoio foi para BAIXO do botão. Ao lado, ela lia como sobra de texto
              e disputava a linha com o próprio botão; embaixo, vira a legenda que responde
              "o que acontece se eu clicar?" — que é a dúvida que trava o clique. */}
          <div className="mt-7">
            <a href="#try" className="group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold text-g-word ring-1 transition hover:brightness-110" style={{ background: "linear-gradient(180deg,#3a3a3a,#181818)", "--tw-ring-color": "rgba(255,138,51,0.32)", boxShadow: "0 14px 40px -14px rgba(0,0,0,0.8), 0 0 26px -6px rgba(255,138,51,0.30)" }}>
              <span className="grid h-6 w-6 place-items-center rounded-full text-xs" style={{ background: "linear-gradient(135deg,rgba(255,138,51,0.55),rgba(214,194,154,0.35))" }}>🌱</span>
              {C.cta}
            </a>
            {/* ⚠️ O CAMPO SUBIU PRA CÁ (2026-08-17, antes de rodar anúncio) ────────────────────
                Esta linha PROMETE "deixe seu número — ela liga em um minuto" desde sempre. Só que o
                primeiro campo de telefone da página vivia a **9.674 px** daqui (medido no DOM, no
                viewport de 375px): a pessoa que vem do anúncio lê a promessa e não tem onde digitar.
                O único clicável da dobra era um pulo de âncora para `#try`.
                Amplitude de catálogo pode esperar; o campo que captura o lead, não — tráfego pago
                não rola 9 mil pixels procurando um input.
                ⚠️ É O MESMO `LiveCallBar`, na variante que já existia, NUNCA um segundo caminho de
                lead: consentimento TCPA, `/api/lead` (noCall) + `/api/call` com o portão de DNC e
                teto, e a recusa REAL aparecendo na tela. Um caminho só, provado, três cascas.
                `max-w-md` porque na coluna do herói (desktop) o campo esticado até a borda lê como
                formulário de rodapé, não como o ato principal. */}
            <p className="mt-3 text-[12.5px] text-g-muted">{C.sub2}</p>
            <div className="mt-3 max-w-md"><LiveCallBar compacto source="heroi" /></div>
          </div>
        </div>

        <div className="relative min-w-0">
          <Phone />
          {/* Honesty caption — the live panel + floating stat cards are a DEMO of what Gui does, not
              client-sourced results; keeps the claims clean (FTC-safe) without killing the vibe. */}
          <p className="mt-3 text-center text-[10.5px] text-g-muted/60">
            {lang === "pt" ? "Demonstração ilustrativa do que a Gui faz no dia a dia."
              : lang === "es" ? "Demostración ilustrativa de lo que Gui hace en el día a día."
              : lang === "hi" ? "Gui रोज़ क्या करती है इसका उदाहरण।"
              : "Illustrative demo of what Gui does day-to-day."}
          </p>
        </div>
      </div>
    </section>
  );
}
