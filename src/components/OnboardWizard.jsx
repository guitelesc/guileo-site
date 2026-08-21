import { useState, useMemo, useEffect, useRef } from "react";
import { VOICES, voiceByKey, DEFAULT_VOICE_KEY } from "../data/agentVoices";
import { CHANNELS, CHANNELS_LIVE, CHANNELS_PENDING } from "../data/onboardChannels";
import { VERTICALS, VERTICAL_KEYS } from "../data/verticals.js";
import { GUILEO_PLANS, planByKey, payLink } from "../data/guileoPlans.js";
import OnboardProducts from "./OnboardProducts.jsx";

// OnboardWizard — CADASTRO COMPLETO, agora em forma de QUIZ. Uma pergunta por tela; o vendedor
// responde JUNTO com o cliente. Continua gravando o MESMO rascunho em /api/onboard-draft
// {action:'save'} → Luis aprova em 1 clique no /admin → nasce a Gui dedicada do cliente.
// As chaves do payload são as MESMAS de antes (ver assemble()); só a apresentação mudou, mais o
// campo novo `products` (o que a Guileo vai entregar).
//
// ═══ POR QUE VIROU QUIZ (Luis, 2026-08-20) ═════════════════════════════════════════════════════
// «o cadastro tem que ser como um QUIZ: fácil, o cliente preenche rápido, o vendedor responde
// junto, menos cansativo e preciso.» O formulário antigo era UMA página com sete seções abertas —
// o cliente via a parede inteira antes de responder a primeira linha.
//
// O desenho abaixo segue PESQUISA, não gosto. Cada decisão tem fonte:
//  1. UMA PERGUNTA POR TELA — o formato conversacional bate o formulário web em taxa de resposta
//     e em qualidade do dado (RCT com 2.063 respondentes, revisado por pares).
//  2. O E-MAIL É A PRIMEIRA PERGUNTA (+18% de conclusão — Typeform, 10.000 formulários).
//  3. TETO DE 8 CAMPOS DIGITÁVEIS no caminho obrigatório. O que mede abandono é número de CAMPO,
//     não de etapa nem de clique (Baymard). Os oito são: e-mail · nome do negócio · telefone do
//     dono · descrição · endereço · nome do agente · logo · DDD-ou-número. TUDO o mais que se
//     digitava virou toque (segmento, idiomas, plano, canais) ou nasce PRÉ-PREENCHIDO.
//     ⚠️ SELECIONAR NÃO É DIGITAR: os 18 produtos cabem numa tela só como fichas porque tocar em
//     ficha é gesto, não trabalho — é isso que deixa o cliente ver a amplitude inteira do catálogo
//     sem pagar o preço do formulário longo.
//  4. PRÉ-PREENCHER O QUE JÁ SE SABE (+4,8%): `prefill` do Follow-up entra marcado como tal; nome
//     da unidade e créditos do plano nascem preenchidos e visíveis, não perguntados.
//  5. "PASSO N DE M", NUNCA PORCENTAGEM (NN/g: o usuário não sabe quanto dura cada etapa, então a
//     porcentagem não informa nada). Dá para voltar em qualquer etapa já visitada.
//  6. A TELA DE BOAS-VINDAS NÃO PERGUNTA NADA (pergunta ali custa −5% de conclusão).
//  7. SALVA A CADA RESPOSTA — ver o bloco RASCUNHO logo abaixo.
//
// ═══ RASCUNHO: POR QUE O AUTO-SAVE É LOCAL E O SERVIDOR SÓ NO FIM ══════════════════════════════
// `draft_save` (db/onboard_completo.sql) faz INSERT — sempre. Não existe upsert por id. Chamar o
// endpoint a cada resposta criaria uma FILEIRA DE RASCUNHOS DUPLICADOS do mesmo cliente na fila de
// aprovação do Luis: exatamente o defeito de cliente duplicado que este repositório já pagou.
// Então: cada resposta grava no aparelho (localStorage, restaurável) e o rascunho de verdade vai
// ao servidor UMA vez, no fim. Para gravar no servidor a cada resposta é preciso um `draft_save`
// com p_id (upsert) — mudança em functions/db, pedida no relatório.
// 🚨 E "salvo" só aparece depois de LER a resposta e confirmar o `id`. `r.ok` não é prova: um 200
// com corpo vazio já foi lido como sucesso aqui dentro e virou cliente que nunca existiu.

const ORANGE = "#FF8A33"; // Gui / agent signal color

// SPOKEN languages — what the client's Gui answers calls in (mirrors LANGS_SPOKEN in
// functions/lib/provision.js; ElevenLabs multilingual TTS covers all of them). The checked codes flow
// into payload.languages. The PORTAL/UI itself stays 4 languages (UI_LANGS) — that's the primary select.
const LANG_OPTS = [
  ["pt", "🇧🇷 Português"], ["en", "🇺🇸 English"], ["es", "🇪🇸 Español"], ["hi", "🇮🇳 हिन्दी"],
  // Cantonês, crioulo haitiano, bengali e punjabi saíram em 2026-08-05: a plataforma de voz não os
  // suporta, e oferecer no cadastro um idioma que a agente não fala é vender o que não existe.
  ["zh", "🇨🇳 中文 Mandarim"], ["ru", "🇷🇺 Русский Russo"], ["ko", "🇰🇷 한국어 Coreano"],
  ["fr", "🇫🇷 Français"], ["ar", "🇸🇦 العربية Árabe"], ["vi", "🇻🇳 Tiếng Việt"],
  ["tl", "🇵🇭 Tagalog"], ["de", "🇩🇪 Deutsch"],
  ["it", "🇮🇹 Italiano"], ["pl", "🇵🇱 Polski"], ["ja", "🇯🇵 日本語"], ["uk", "🇺🇦 Українська"],
];
const UI_LANGS = ["pt", "en", "es", "hi"]; // the owner's portal languages — only these can be PRIMARY
const TZ_OPTS = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "America/Sao_Paulo", "America/Mexico_City", "Europe/Lisbon",
  "Europe/Madrid", "Asia/Kolkata",
];
const WEEKDAYS = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  hi: ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"],
};

// channel-key -> the exact sub-field of the canonical `channels` payload it feeds.
const CH_FIELD = { phone: "mode", whatsapp: "number", widget: "enabled", instagram: "handle", facebook: "handle", linkedin: "url", tiktok: "handle", youtube: "url", google_business: "url", ads: "enabled", reviews: "link" };
const CH_ICON = { phone: "📞", sms: "💬", email: "✉️", widget: "🌐", whatsapp: "🟢", instagram: "📸", facebook: "👍", linkedin: "💼", tiktok: "🎵", youtube: "▶️", google_business: "🗺️", ads: "📣", reviews: "⭐" };
const CH_LABEL = {
  en: { phone: "Phone / Voice", sms: "SMS", email: "Email", widget: "Website widget", whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube", google_business: "Google Business", ads: "Ads", reviews: "Reviews link" },
  pt: { phone: "Telefone / Voz", sms: "SMS", email: "E-mail", widget: "Widget no site", whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube", google_business: "Google Meu Negócio", ads: "Anúncios (Ads)", reviews: "Link de avaliações" },
  es: { phone: "Teléfono / Voz", sms: "SMS", email: "Email", widget: "Widget en el sitio", whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube", google_business: "Google Mi Negocio", ads: "Anuncios (Ads)", reviews: "Enlace de reseñas" },
  hi: { phone: "फ़ोन / वॉइस", sms: "SMS", email: "ईमेल", widget: "साइट विजेट", whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube", google_business: "Google बिज़नेस", ads: "विज्ञापन (Ads)", reviews: "रिव्यू लिंक" },
};
const CH_PH = { whatsapp: "+1 305 555 0100", instagram: "@perfil", facebook: "@perfil", linkedin: "https://linkedin.com/company/…", tiktok: "@perfil", youtube: "https://youtube.com/@canal", google_business: "https://g.page/…", reviews: "https://g.page/r/…/review" };

// Fallback channel list (canonical order) used only if the shared data module ships empty.
const FALLBACK_CHANNELS = [
  { key: "phone", status: "live" }, { key: "widget", status: "live" }, { key: "email", status: "live" }, { key: "sms", status: "live" },
  { key: "whatsapp", status: "pending" }, { key: "instagram", status: "pending" }, { key: "facebook", status: "pending" }, { key: "linkedin", status: "pending" },
  { key: "tiktok", status: "pending" }, { key: "youtube", status: "pending" }, { key: "google_business", status: "pending" }, { key: "ads", status: "pending" }, { key: "reviews", status: "pending" },
];

const keyOf = (x) => (typeof x === "string" ? x : (x && (x.key || x.id || x.name)) || "");

// ── i18n — 4 IDIOMAS COMPLETOS, RESERVA SEMPRE `en` ────────────────────────────────────────────
// O dicionário antigo tinha pt/en/es e caía em PT quando a página estava em हिन्दी: metade da tela
// numa língua, metade em outra. Chave ausente em JS devolve `undefined` e o React desenha NADA —
// por isso toda leitura aqui é `Q[lang] || Q.en`, e `en` é a reserva (nunca pt).
const Q = {
  en: {
    eyebrow: "Client intake", title: "Give birth to the client's Gui",
    welcomeSub: "A few quick questions, one at a time. Answer them together with the client — it takes about 5 minutes and nothing gets lost: every answer is kept on this device.",
    start: "Start", resume: "Continue where you left off", restart: "Start over", resumeFound: "There's an unfinished intake on this device.",
    back: "Back", next: "Continue", finish: "Save the intake", optional: "optional", savedLocal: "saved on this device",
    stepOf: (a, b) => `Step ${a} of ${b}`,
    qEmail: "What's the client's email?", hEmail: "This is how they sign in to the portal and receive the access code.",
    qBiz: "What's the business called?", hBiz: "Exactly as the client says it out loud — Gui answers the phone with this name.",
    qPhone: "Owner's phone for alerts", qVert: "What kind of business is it?", hVert: "Tap all that apply.",
    qDesc: "What does the business do?", hDesc: "One or two sentences: what it sells and the tone of voice.",
    qServices: "Services and prices", hServices: "Without a price Gui can't quote or close. Add the main ones — the rest can come later.",
    qProducts: "What is Guileo going to deliver?", hProducts: "Everything we build and run. Tap what this client is taking.",
    qPlace: "Where is it and when does it open?", hPlace: "The address Gui gives out, and the hours it books inside.",
    qAgent: "Who answers the phone?", hAgent: "The name and voice the client's customers will hear.",
    qBrand: "The look of the Gui", hBrand: "Logo and color of the widget on the client's site.",
    qNumber: "The phone number", hNumber: "Each client gets their own number — never a shared one.",
    qChannels: "Where do customers talk to them?", hChannels: "Tap a channel to add it. Capture it now — pending ones light up when that platform's API is approved.",
    qPlan: "Which plan?", qReview: "Review and save", hReview: "Check it with the client before saving.",
    bizName: "Business name", clientEmail: "Client email", bizDesc: "Description", verticals: "Verticals",
    langs: "Languages Gui speaks", langsNote: "Gui answers each caller in their own language. The owner's portal stays in EN·PT·ES·HI.",
    primaryLang: "Primary language", agentName: "Agent name", voice: "Voice", logo: "Logo URL", accent: "Accent color",
    addUnit: "+ Another location", unit: "Location", uName: "Location name", uAddress: "Address", uPhone: "Location phone", uTz: "Timezone", uHours: "Weekly hours", closed: "Closed", remove: "Remove", allDays: "Apply to every open day",
    addService: "+ Another service", svcName: "Service", svcDur: "Minutes", svcPrice: "Price $", svcDeposit: "Deposit $",
    addMember: "+ Person", team: "Team", mName: "Name", mTitle: "Title", mServices: "Services (comma-separated)", mLocations: "Locations (comma-separated)",
    live: "live", pending: "awaiting API",
    phoneBuy: "Buy a new one", phoneMap: "Map an existing one", phoneNone: "No number for now",
    areaCode: "Area code", existingNum: "Existing number", forward: "Forward to (overflow)",
    widgetOn: "Widget on the client's site", adsOn: "Run ads",
    supportLink: "Support link", reviewLink: "Reviews link", credits: "Credits", included: "included",
    submit: "Save the intake", submitting: "Saving…", needBiz: "Enter the business name.", needEmail: "Enter a valid client email.",
    okTitle: "Intake saved — awaiting approval", okSub: "Luis approves in 1 click in /admin and the client's Gui is born.",
    draftId: "Draft", newOne: "Add another", errNet: "Couldn't save right now. Try again.",
    widgetSnippet: "Widget snippet (paste on the client's site)", copy: "Copy", copied: "Copied ✓",
    fromFollowup: "from Follow-up", none: "—", products: "Products", pickedN: "picked", noProducts: "no product picked",
  },
  pt: {
    eyebrow: "Cadastro do cliente", title: "Nascer a Gui do cliente",
    welcomeSub: "Umas poucas perguntas, uma de cada vez. Responda junto com o cliente — leva uns 5 minutos e nada se perde: cada resposta fica guardada neste aparelho.",
    start: "Começar", resume: "Continuar de onde parou", restart: "Começar do zero", resumeFound: "Tem um cadastro inacabado neste aparelho.",
    back: "Voltar", next: "Continuar", finish: "Salvar o cadastro", optional: "opcional", savedLocal: "salvo neste aparelho",
    stepOf: (a, b) => `Passo ${a} de ${b}`,
    qEmail: "Qual o e-mail do cliente?", hEmail: "É com ele que o cliente entra no portal e recebe o código de acesso.",
    qBiz: "Como se chama o negócio?", hBiz: "Do jeito que o cliente fala — é com esse nome que a Gui atende o telefone.",
    qPhone: "Telefone do dono para alertas", qVert: "Que tipo de negócio é?", hVert: "Toque em quantos servirem.",
    qDesc: "O que o negócio faz?", hDesc: "Uma ou duas frases: o que vende e o tom de voz.",
    qServices: "Serviços e preços", hServices: "Sem preço a Gui não cota nem fecha. Coloque os principais — o resto entra depois.",
    qProducts: "O que a Guileo vai entregar?", hProducts: "Tudo o que a gente constrói e opera. Toque no que este cliente está levando.",
    qPlace: "Onde fica e quando abre?", hPlace: "O endereço que a Gui informa e o horário dentro do qual ela agenda.",
    qAgent: "Quem vai atender?", hAgent: "O nome e a voz que os clientes dele vão ouvir.",
    qBrand: "A cara da Gui", hBrand: "Logo e cor do widget no site do cliente.",
    qNumber: "O número de telefone", hNumber: "Cada cliente tem um número PRÓPRIO — nunca compartilhado.",
    qChannels: "Onde os clientes falam com ele?", hChannels: "Toque no canal para acrescentar. Capture agora — os pendentes acendem quando a API daquela plataforma for aprovada.",
    qPlan: "Qual plano?", qReview: "Revisar e salvar", hReview: "Confira junto com o cliente antes de salvar.",
    bizName: "Nome do negócio", clientEmail: "E-mail do cliente", bizDesc: "Descrição", verticals: "Segmentos",
    langs: "Idiomas que a Gui fala", langsNote: "A Gui atende cada pessoa no idioma dela. O portal do dono fica em PT·EN·ES·HI.",
    primaryLang: "Idioma principal", agentName: "Nome do agente", voice: "Voz", logo: "Logo (URL)", accent: "Cor de destaque",
    addUnit: "+ Outra unidade", unit: "Unidade", uName: "Nome da unidade", uAddress: "Endereço", uPhone: "Telefone da unidade", uTz: "Fuso horário", uHours: "Horário semanal", closed: "Fechado", remove: "Remover", allDays: "Aplicar a todos os dias abertos",
    addService: "+ Outro serviço", svcName: "Serviço", svcDur: "Minutos", svcPrice: "Preço $", svcDeposit: "Depósito $",
    addMember: "+ Pessoa", team: "Equipe", mName: "Nome", mTitle: "Cargo", mServices: "Serviços (separe por vírgula)", mLocations: "Unidades (separe por vírgula)",
    live: "ativo", pending: "aguardando API",
    phoneBuy: "Comprar um novo", phoneMap: "Mapear um existente", phoneNone: "Sem número por enquanto",
    areaCode: "DDD / area code", existingNum: "Número existente", forward: "Encaminhar para (transbordo)",
    widgetOn: "Widget no site do cliente", adsOn: "Rodar anúncios",
    supportLink: "Link de suporte", reviewLink: "Link de avaliações", credits: "Créditos", included: "inclusos",
    submit: "Salvar o cadastro", submitting: "Salvando…", needBiz: "Informe o nome do negócio.", needEmail: "Informe um e-mail válido do cliente.",
    okTitle: "Cadastro salvo — aguardando aprovação", okSub: "O Luis aprova em 1 clique no /admin e a Gui do cliente nasce.",
    draftId: "Rascunho", newOne: "Cadastrar outro", errNet: "Não deu pra salvar agora. Tenta de novo.",
    widgetSnippet: "Trecho do widget (cole no site do cliente)", copy: "Copiar", copied: "Copiado ✓",
    fromFollowup: "veio do Follow-up", none: "—", products: "Produtos", pickedN: "escolhidos", noProducts: "nenhum produto escolhido",
  },
  es: {
    eyebrow: "Alta del cliente", title: "Dar a luz a la Gui del cliente",
    welcomeSub: "Unas pocas preguntas, una a la vez. Respóndelas junto al cliente — toma unos 5 minutos y nada se pierde: cada respuesta queda guardada en este aparato.",
    start: "Empezar", resume: "Continuar donde quedó", restart: "Empezar de cero", resumeFound: "Hay un alta sin terminar en este aparato.",
    back: "Volver", next: "Continuar", finish: "Guardar el alta", optional: "opcional", savedLocal: "guardado en este aparato",
    stepOf: (a, b) => `Paso ${a} de ${b}`,
    qEmail: "¿Cuál es el email del cliente?", hEmail: "Con él entra al portal y recibe el código de acceso.",
    qBiz: "¿Cómo se llama el negocio?", hBiz: "Tal como lo dice el cliente — con ese nombre atiende Gui el teléfono.",
    qPhone: "Teléfono del dueño para alertas", qVert: "¿Qué tipo de negocio es?", hVert: "Toca todos los que sirvan.",
    qDesc: "¿Qué hace el negocio?", hDesc: "Una o dos frases: qué vende y el tono de voz.",
    qServices: "Servicios y precios", hServices: "Sin precio Gui no cotiza ni cierra. Pon los principales — el resto entra después.",
    qProducts: "¿Qué va a entregar Guileo?", hProducts: "Todo lo que construimos y operamos. Toca lo que este cliente se lleva.",
    qPlace: "¿Dónde está y cuándo abre?", hPlace: "La dirección que Gui informa y el horario dentro del cual agenda.",
    qAgent: "¿Quién va a atender?", hAgent: "El nombre y la voz que sus clientes van a escuchar.",
    qBrand: "La cara de la Gui", hBrand: "Logo y color del widget en el sitio del cliente.",
    qNumber: "El número de teléfono", hNumber: "Cada cliente tiene un número PROPIO — nunca compartido.",
    qChannels: "¿Dónde le hablan sus clientes?", hChannels: "Toca el canal para agregarlo. Captúralo ahora — los pendientes se encienden cuando esa API se apruebe.",
    qPlan: "¿Qué plan?", qReview: "Revisar y guardar", hReview: "Revísalo junto al cliente antes de guardar.",
    bizName: "Nombre del negocio", clientEmail: "Email del cliente", bizDesc: "Descripción", verticals: "Rubros",
    langs: "Idiomas que habla Gui", langsNote: "Gui atiende a cada persona en su idioma. El portal del dueño queda en ES·EN·PT·HI.",
    primaryLang: "Idioma principal", agentName: "Nombre del agente", voice: "Voz", logo: "Logo (URL)", accent: "Color de acento",
    addUnit: "+ Otra sucursal", unit: "Sucursal", uName: "Nombre de la sucursal", uAddress: "Dirección", uPhone: "Teléfono de la sucursal", uTz: "Zona horaria", uHours: "Horario semanal", closed: "Cerrado", remove: "Quitar", allDays: "Aplicar a todos los días abiertos",
    addService: "+ Otro servicio", svcName: "Servicio", svcDur: "Minutos", svcPrice: "Precio $", svcDeposit: "Depósito $",
    addMember: "+ Persona", team: "Equipo", mName: "Nombre", mTitle: "Cargo", mServices: "Servicios (separa por coma)", mLocations: "Sucursales (separa por coma)",
    live: "activo", pending: "esperando API",
    phoneBuy: "Comprar uno nuevo", phoneMap: "Mapear uno existente", phoneNone: "Sin número por ahora",
    areaCode: "Código de área", existingNum: "Número existente", forward: "Desviar a (desborde)",
    widgetOn: "Widget en el sitio del cliente", adsOn: "Correr anuncios",
    supportLink: "Enlace de soporte", reviewLink: "Enlace de reseñas", credits: "Créditos", included: "incluidos",
    submit: "Guardar el alta", submitting: "Guardando…", needBiz: "Ingresa el nombre del negocio.", needEmail: "Ingresa un email válido del cliente.",
    okTitle: "Alta guardada — esperando aprobación", okSub: "Luis aprueba en 1 clic en /admin y nace la Gui del cliente.",
    draftId: "Borrador", newOne: "Cargar otro", errNet: "No se pudo guardar ahora. Intenta de nuevo.",
    widgetSnippet: "Fragmento del widget (pégalo en el sitio del cliente)", copy: "Copiar", copied: "Copiado ✓",
    fromFollowup: "vino del Follow-up", none: "—", products: "Productos", pickedN: "elegidos", noProducts: "ningún producto elegido",
  },
  hi: {
    eyebrow: "क्लाइंट पंजीकरण", title: "क्लाइंट की Gui को जन्म दें",
    welcomeSub: "कुछ छोटे सवाल, एक-एक करके। क्लाइंट के साथ मिलकर जवाब दें — लगभग 5 मिनट लगते हैं और कुछ खोता नहीं: हर जवाब इसी डिवाइस पर सुरक्षित रहता है।",
    start: "शुरू करें", resume: "जहाँ छोड़ा था वहीं से जारी रखें", restart: "नए सिरे से शुरू करें", resumeFound: "इस डिवाइस पर एक अधूरा पंजीकरण है।",
    back: "पीछे", next: "आगे", finish: "पंजीकरण सेव करें", optional: "वैकल्पिक", savedLocal: "इस डिवाइस पर सेव",
    stepOf: (a, b) => `चरण ${a} / ${b}`,
    qEmail: "क्लाइंट का ईमेल क्या है?", hEmail: "इसी से वह पोर्टल में लॉगिन करता है और एक्सेस कोड पाता है।",
    qBiz: "व्यवसाय का नाम क्या है?", hBiz: "जैसे क्लाइंट बोलता है — Gui इसी नाम से फ़ोन उठाती है।",
    qPhone: "अलर्ट के लिए मालिक का फ़ोन", qVert: "यह किस तरह का व्यवसाय है?", hVert: "जितने लागू हों, सब दबाएँ।",
    qDesc: "व्यवसाय क्या करता है?", hDesc: "एक-दो वाक्य: क्या बेचता है और किस लहजे में।",
    qServices: "सेवाएँ और कीमतें", hServices: "कीमत के बिना Gui न कोट कर सकती है न सौदा बंद। मुख्य सेवाएँ डालें — बाकी बाद में।",
    qProducts: "Guileo क्या देने वाली है?", hProducts: "जो कुछ हम बनाते और चलाते हैं। जो यह क्लाइंट ले रहा है उसे दबाएँ।",
    qPlace: "कहाँ है और कब खुलता है?", hPlace: "वह पता जो Gui बताती है, और वह समय जिसमें वह बुकिंग करती है।",
    qAgent: "फ़ोन कौन उठाएगा?", hAgent: "वह नाम और आवाज़ जो उसके ग्राहक सुनेंगे।",
    qBrand: "Gui का चेहरा", hBrand: "क्लाइंट की साइट पर विजेट का लोगो और रंग।",
    qNumber: "फ़ोन नंबर", hNumber: "हर क्लाइंट का अपना नंबर होता है — कभी साझा नहीं।",
    qChannels: "ग्राहक उससे कहाँ बात करते हैं?", hChannels: "चैनल जोड़ने के लिए दबाएँ। अभी दर्ज करें — लंबित चैनल तब चालू होंगे जब उस प्लेटफ़ॉर्म की API मंज़ूर होगी।",
    qPlan: "कौन-सा प्लान?", qReview: "जाँचें और सेव करें", hReview: "सेव करने से पहले क्लाइंट के साथ जाँच लें।",
    bizName: "व्यवसाय का नाम", clientEmail: "क्लाइंट का ईमेल", bizDesc: "विवरण", verticals: "क्षेत्र",
    langs: "Gui जो भाषाएँ बोलती है", langsNote: "Gui हर व्यक्ति से उसकी भाषा में बात करती है। मालिक का पोर्टल EN·PT·ES·HI में रहता है।",
    primaryLang: "मुख्य भाषा", agentName: "एजेंट का नाम", voice: "आवाज़", logo: "लोगो (URL)", accent: "मुख्य रंग",
    addUnit: "+ और शाखा", unit: "शाखा", uName: "शाखा का नाम", uAddress: "पता", uPhone: "शाखा का फ़ोन", uTz: "समय क्षेत्र", uHours: "साप्ताहिक समय", closed: "बंद", remove: "हटाएँ", allDays: "सभी खुले दिनों पर लागू करें",
    addService: "+ और सेवा", svcName: "सेवा", svcDur: "मिनट", svcPrice: "कीमत $", svcDeposit: "डिपॉज़िट $",
    addMember: "+ व्यक्ति", team: "टीम", mName: "नाम", mTitle: "पद", mServices: "सेवाएँ (अल्पविराम से)", mLocations: "शाखाएँ (अल्पविराम से)",
    live: "चालू", pending: "API का इंतज़ार",
    phoneBuy: "नया खरीदें", phoneMap: "मौजूदा जोड़ें", phoneNone: "फ़िलहाल कोई नंबर नहीं",
    areaCode: "एरिया कोड", existingNum: "मौजूदा नंबर", forward: "आगे भेजें (ओवरफ़्लो)",
    widgetOn: "क्लाइंट की साइट पर विजेट", adsOn: "विज्ञापन चलाएँ",
    supportLink: "सपोर्ट लिंक", reviewLink: "रिव्यू लिंक", credits: "क्रेडिट", included: "शामिल",
    submit: "पंजीकरण सेव करें", submitting: "सेव हो रहा है…", needBiz: "व्यवसाय का नाम डालें।", needEmail: "क्लाइंट का सही ईमेल डालें।",
    okTitle: "पंजीकरण सेव — मंज़ूरी बाकी", okSub: "Luis /admin में 1 क्लिक में मंज़ूरी देते हैं और क्लाइंट की Gui जन्म लेती है।",
    draftId: "ड्राफ़्ट", newOne: "एक और जोड़ें", errNet: "अभी सेव नहीं हो सका। फिर कोशिश करें।",
    widgetSnippet: "विजेट कोड (क्लाइंट की साइट पर लगाएँ)", copy: "कॉपी", copied: "कॉपी हो गया ✓",
    fromFollowup: "Follow-up से आया", none: "—", products: "प्रोडक्ट", pickedN: "चुने गए", noProducts: "कोई प्रोडक्ट नहीं चुना",
  },
};

// Owner alert/emergency phone — notify_phone born NULL = every emergency/alert becomes email-only,
// so this field is REQUIRED. Kept in its own dict because the hint is a safety warning, not a label.
const OWNER_PHONE_T = {
  pt: { label: "Telefone do dono (alertas/emergência)", hint: "A Gui LIGA/avisa neste número quando algo é urgente (emergência, transbordo, alerta). Obrigatório — sem ele, emergências não tocam ninguém.", need: "Informe o telefone do dono — é onde a Gui avisa em emergência." },
  en: { label: "Owner phone (alerts/emergency)", hint: "Gui CALLS/alerts this number when something is urgent (emergency, overflow, alert). Required — without it, emergencies reach no one.", need: "Enter the owner phone — it's where Gui alerts on emergencies." },
  es: { label: "Teléfono del dueño (alertas/emergencia)", hint: "Gui LLAMA/avisa a este número cuando algo es urgente (emergencia, desborde, alerta). Obligatorio — sin él, las emergencias no alertan a nadie.", need: "Ingresa el teléfono del dueño — es donde Gui avisa en emergencias." },
  hi: { label: "मालिक का फ़ोन (अलर्ट/आपातकाल)", hint: "कुछ ज़रूरी होने पर (आपातकाल, ओवरफ़्लो, अलर्ट) Gui इसी नंबर पर कॉल/सूचित करती है। अनिवार्य — इसके बिना आपात स्थिति में किसी को सूचना नहीं मिलेगी।", need: "मालिक का फ़ोन नंबर डालें — आपात स्थिति में Gui यहीं सूचित करती है।" },
};

// 🚨 16px É REGRA, NÃO GOSTO: abaixo disso o Safari do iPhone dá ZOOM ao focar o campo e o layout
// quebra no meio do cadastro — com o cliente olhando. Alvo de 48px é o número do Material para uso
// na rua (o piso de 24px da WCAG é para mouse, não para dedo em pé numa loja).
const inp = "w-full min-h-[48px] rounded-xl border border-white/15 bg-white/[0.05] px-3.5 py-2.5 text-[16px] text-g-word placeholder:text-g-muted/55 focus:outline-none focus:border-g-gold/60";
const sel = inp + " appearance-none";
const lbl = "text-[11px] font-bold uppercase tracking-wide text-g-muted";
const chip = (on) => `min-h-[48px] rounded-full px-4 text-[14px] font-bold transition ${on ? "bg-g-green/15 text-g-word ring-1 ring-g-green/45" : "bg-white/[0.04] text-g-muted ring-1 ring-white/10 hover:text-g-word"}`;

const hhmmToMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim()); if (!m) return null; const h = +m[1], mm = +m[2]; if (h > 23 || mm > 59) return null; return h * 60 + mm; };
const emptyHours = () => Array.from({ length: 7 }, (_, w) => ({ weekday: w, open: "09:00", close: "18:00", closed: w === 0 }));
const newLocation = () => ({ name: "", address: "", phone: "", tz: "America/New_York", hours: emptyHours() });
// vertical: "" de propósito — o serviço herda o SEGMENTO que o vendedor já escolheu duas telas
// antes (ver svcVert). Nascer em "Restaurant" num salão é o formulário respondendo errado sozinho.
const newService = () => ({ name: "", vertical: "", duration_min: 30, price: "", deposit: "" });
const newMember = () => ({ name: "", title: "", services: "", locations: "" });
const centsOf = (v) => { const n = parseFloat(String(v).replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? Math.round(n * 100) : null; };

// ── SEGMENTO EM 4 IDIOMAS (remendo consciente) ────────────────────────────────────────────────
// `VERTICALS` (src/data/verticals.js) é config de cockpit e carrega UM `label` só, em inglês —
// então uma página em português mostrava "Restaurant · Salon & Spa · Law Firm". Duas línguas na
// mesma tela é a regra que o Luis já cobrou, e aqui ela cai bem no meio do cadastro.
// O CERTO é `labels: {en,pt,es,hi}` dentro de verticals.js (fonte única) — pedido no relatório;
// este arquivo não é dono daquele. Até lá, a tradução mora aqui e a RESERVA é o label da fonte:
// segmento novo aparece em inglês (visível e feio de propósito) em vez de sumir da lista.
const VERT_T = {
  pt: { restaurant: "Restaurante", clinic: "Clínica", salon: "Salão & Spa", law: "Escritório de advocacia", ecommerce: "E-commerce", realestate: "Imobiliária", gym: "Academia & Fitness", medical: "Consultório médico", homeservices: "Encanamento & Climatização", auto: "Concessionária", education: "Educação", construction: "Construção" },
  es: { restaurant: "Restaurante", clinic: "Clínica", salon: "Salón & Spa", law: "Estudio jurídico", ecommerce: "E-commerce", realestate: "Inmobiliaria", gym: "Gimnasio & Fitness", medical: "Consultorio médico", homeservices: "Plomería & Climatización", auto: "Concesionaria", education: "Educación", construction: "Construcción" },
  hi: { restaurant: "रेस्टोरेंट", clinic: "क्लिनिक", salon: "सैलून & स्पा", law: "विधि फर्म", ecommerce: "ई-कॉमर्स", realestate: "रियल एस्टेट", gym: "जिम & फ़िटनेस", medical: "मेडिकल", homeservices: "प्लंबिंग & HVAC", auto: "ऑटो डीलरशिप", education: "शिक्षा", construction: "निर्माण" },
};
const vertLabel = (k, lang) => (VERT_T[lang] && VERT_T[lang][k]) || VERTICALS[k]?.label || k;

const LS_KEY = "guileo_onboard_quiz_v1";
const LS_MAX_AGE = 7 * 24 * 3600 * 1000; // uma semana: rascunho mais velho que isso é lixo, não memória

export default function OnboardWizard({ token, mode = "seller", lang = "pt", seller = null, onSaved, prefill = null }) {
  const t = Q[lang] || Q.en;
  const op = OWNER_PHONE_T[lang] || OWNER_PHONE_T.en;
  const wd = WEEKDAYS[lang] || WEEKDAYS.en;
  const chLabel = CH_LABEL[lang] || CH_LABEL.en;
  const chList = useMemo(() => (Array.isArray(CHANNELS) && CHANNELS.length ? CHANNELS : FALLBACK_CHANNELS), []);
  const liveKeys = useMemo(() => new Set((Array.isArray(CHANNELS_LIVE) ? CHANNELS_LIVE : []).map(keyOf).filter(Boolean)), []);
  const pendKeys = useMemo(() => new Set((Array.isArray(CHANNELS_PENDING) ? CHANNELS_PENDING : []).map(keyOf).filter(Boolean)), []);

  // ── Business ──
  const [business, setBusiness] = useState(() => (prefill?.business || ""));
  const [clientEmail, setClientEmail] = useState(() => (prefill?.email || ""));
  const [notifyPhone, setNotifyPhone] = useState(() => (prefill?.notify_phone || prefill?.owner_phone || prefill?.phone || ""));
  const [description, setDescription] = useState("");
  const [verticals, setVerticals] = useState([]);
  const [languages, setLanguages] = useState(["pt"]);
  const [primaryLang, setPrimaryLang] = useState("pt");
  // ── Agent + brand ──
  const [agentName, setAgentName] = useState("");
  const [voiceKey, setVoiceKey] = useState(DEFAULT_VOICE_KEY || (Array.isArray(VOICES) && VOICES[0] && (VOICES[0].key || VOICES[0].id)) || "");
  const [logoUrl, setLogoUrl] = useState("");
  const [accent, setAccent] = useState(ORANGE);
  // ── Repeatables ──
  const [locations, setLocations] = useState([newLocation()]);
  const [services, setServices] = useState([newService()]);
  const [team, setTeam] = useState([]);
  // ── Produtos (o catálogo inteiro, escolhido por toque) ──
  const [products, setProducts] = useState([]);
  // ── Channels ──
  const [phone, setPhone] = useState({ mode: "buy", area_code: "", existing_number: "", forward: "" });
  const [showForward, setShowForward] = useState(false);
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [chOn, setChOn] = useState({});   // canal aberto (toque) → só então aparece o campo de texto
  const [chText, setChText] = useState({});
  // ── Extras ──
  const [supportLink, setSupportLink] = useState("");
  const [reviewLink, setReviewLink] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [plan, setPlan] = useState("growth");
  const [credits, setCredits] = useState(440);
  const [editCredits, setEditCredits] = useState(false);
  // ── Quiz ──
  const [step, setStep] = useState(-1); // -1 = boas-vindas (não pergunta nada)
  const [maxSeen, setMaxSeen] = useState(-1);
  const [resumable, setResumable] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  // ── Submit ──
  const [state, setState] = useState("idle"); // idle | go | done | err
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const topRef = useRef(null);

  const voices = Array.isArray(VOICES) ? VOICES : [];
  const selectedVoice = useMemo(() => { try { return typeof voiceByKey === "function" ? voiceByKey(voiceKey) : voices.find((v) => (v.key || v.id) === voiceKey); } catch { return null; } }, [voiceKey, voices]);

  const toggleVertical = (k) => setVerticals((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  const toggleProduct = (id) => setProducts((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const toggleLang = (c) => setLanguages((a) => {
    const next = a.includes(c) ? a.filter((x) => x !== c) : [...a, c];
    if (!next.length) return a; // keep at least one
    if (!next.includes(primaryLang)) setPrimaryLang(next.find((x) => UI_LANGS.includes(x)) || "en");
    return next;
  });
  const setLoc = (i, patch) => setLocations((a) => a.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const setHour = (i, w, patch) => setLocations((a) => a.map((l, j) => (j === i ? { ...l, hours: l.hours.map((h) => (h.weekday === w ? { ...h, ...patch } : h)) } : l)));
  const applyHoursToAll = (i, open, close) => setLocations((a) => a.map((l, j) => (j === i ? { ...l, hours: l.hours.map((h) => (h.closed ? h : { ...h, open, close })) } : l)));
  const svcVert = (s) => s.vertical || verticals[0] || VERTICAL_KEYS[0] || "";
  const setSvc = (i, patch) => setServices((a) => a.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setMem = (i, patch) => setTeam((a) => a.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  // ── SUGESTÃO DE PRODUTO A PARTIR DOS SERVIÇOS (o "combine" do pedido) ──────────────────────
  // Rótulo é "sugerido", nunca "necessário": a sugestão sai de SINAL REAL já digitado nesta tela
  // (serviço com preço → a Gui pode cobrar; serviço com duração → tem agenda a proteger), e o
  // vendedor decide. Sugerir por adivinhação seria vender o que ninguém mediu.
  const suggested = useMemo(() => {
    const s = new Set(["answering", "multilingual", "speedlead"]); // toda empresa que atende telefone
    const svc = services.filter((x) => x.name.trim());
    if (svc.some((x) => centsOf(x.price) > 0)) { s.add("close_collect"); }
    if (svc.some((x) => (parseInt(x.duration_min, 10) || 0) > 0)) { s.add("noshow"); }
    if (svc.length) s.add("reactivation");
    if (adsEnabled) s.add("marketing_ads");
    return [...s];
  }, [services, adsEnabled]);

  const assemble = () => {
    const cv = (k) => (chOn[k] ? (chText[k] || "").trim() : "");
    const commaArr = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
    return {
      business: business.trim(),
      client_email: clientEmail.trim().toLowerCase(),
      notify_phone: notifyPhone.trim(),
      description: description.trim(),
      verticals,
      lang: primaryLang,
      languages,
      agent: { name: agentName.trim(), voice_key: voiceKey },
      brand: { logo_url: logoUrl.trim(), accent },
      // o nome da unidade nasce PRÉ-PREENCHIDO com o do negócio (uma pergunta a menos, zero perda)
      locations: locations.map((l) => ({
        name: l.name.trim() || business.trim(), address: l.address.trim(), phone: l.phone.trim(), tz: l.tz,
        hours: l.hours.filter((h) => !h.closed && hhmmToMin(h.open) != null && hhmmToMin(h.close) != null)
          .map((h) => ({ weekday: h.weekday, open_min: hhmmToMin(h.open), close_min: hhmmToMin(h.close) })),
      })),
      services: services.filter((s) => s.name.trim()).map((s) => ({
        name: s.name.trim(), vertical: svcVert(s), duration_min: parseInt(s.duration_min, 10) || 0,
        price_cents: centsOf(s.price), deposit_cents: s.deposit === "" ? null : centsOf(s.deposit),
      })),
      team: team.filter((m) => m.name.trim()).map((m) => ({ name: m.name.trim(), title: m.title.trim(), services: commaArr(m.services), locations: commaArr(m.locations) })),
      // NOVO: o que a Guileo vai entregar. Ids do catálogo (src/data/productSystem.js) — nunca nomes
      // soltos, para que /admin e a proposta leiam o MESMO produto que o vendedor apontou.
      products,
      channels: {
        phone: { mode: phone.mode, area_code: phone.area_code.trim(), existing_number: phone.existing_number.trim(), forward: phone.forward.trim() },
        whatsapp: { number: cv("whatsapp") },
        widget: { enabled: widgetEnabled },
        instagram: { handle: cv("instagram") },
        facebook: { handle: cv("facebook") },
        linkedin: { url: cv("linkedin") },
        tiktok: { handle: cv("tiktok") },
        youtube: { url: cv("youtube") },
        google_business: { url: cv("google_business") },
        ads: { enabled: adsEnabled },
        reviews: { link: cv("reviews") },
      },
      support_link: supportLink.trim(),
      review_link: reviewLink.trim(),
      plan,
      credits: parseInt(credits, 10) || 0,
    };
  };

  // ── AUTO-SAVE A CADA RESPOSTA (no aparelho) ─────────────────────────────────────────────────
  const snapshot = useMemo(() => ({
    business, clientEmail, notifyPhone, description, verticals, languages, primaryLang, agentName,
    voiceKey, logoUrl, accent, locations, services, team, products, phone, widgetEnabled, adsEnabled,
    chOn, chText, supportLink, reviewLink, plan, credits, step,
  }), [business, clientEmail, notifyPhone, description, verticals, languages, primaryLang, agentName,
    voiceKey, logoUrl, accent, locations, services, team, products, phone, widgetEnabled, adsEnabled,
    chOn, chText, supportLink, reviewLink, plan, credits, step]);

  useEffect(() => {
    if (state === "done" || step < 0) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), seller: seller?.email || "", data: snapshot }));
      setSavedAt(Date.now());
    } catch { /* aparelho sem storage: o quiz continua, só não restaura */ }
  }, [snapshot, state, step, seller]);

  // restaurar (só oferece; nunca aplica sozinho — o vendedor pode estar cadastrando OUTRO cliente)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (!o || !o.data || !o.at || Date.now() - o.at > LS_MAX_AGE) { localStorage.removeItem(LS_KEY); return; }
      if (o.data.business || o.data.clientEmail) setResumable(o);
    } catch { /* json podre = sem rascunho */ }
  }, []);

  const applyResume = (o) => {
    const d = o.data || {};
    const put = (fn, v, fb) => fn(v === undefined || v === null ? fb : v);
    put(setBusiness, d.business, ""); put(setClientEmail, d.clientEmail, ""); put(setNotifyPhone, d.notifyPhone, "");
    put(setDescription, d.description, ""); put(setVerticals, d.verticals, []); put(setLanguages, d.languages, ["pt"]);
    put(setPrimaryLang, d.primaryLang, "pt"); put(setAgentName, d.agentName, ""); put(setVoiceKey, d.voiceKey, voiceKey);
    put(setLogoUrl, d.logoUrl, ""); put(setAccent, d.accent, ORANGE);
    put(setLocations, Array.isArray(d.locations) && d.locations.length ? d.locations : [newLocation()], [newLocation()]);
    put(setServices, Array.isArray(d.services) && d.services.length ? d.services : [newService()], [newService()]);
    put(setTeam, d.team, []); put(setProducts, d.products, []);
    put(setPhone, d.phone, { mode: "buy", area_code: "", existing_number: "", forward: "" });
    put(setWidgetEnabled, d.widgetEnabled, true); put(setAdsEnabled, d.adsEnabled, false);
    put(setChOn, d.chOn, {}); put(setChText, d.chText, {});
    put(setSupportLink, d.supportLink, ""); put(setReviewLink, d.reviewLink, "");
    put(setPlan, d.plan, "growth"); put(setCredits, d.credits, 440);
    const s = Number.isInteger(d.step) ? d.step : 0;
    setStep(s); setMaxSeen(Math.max(maxSeen, s)); setResumable(null);
  };
  const dropResume = () => { try { localStorage.removeItem(LS_KEY); } catch { /* */ } setResumable(null); };

  const submit = async () => {
    if (!business.trim()) { setErr(t.needBiz); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail.trim())) { setErr(t.needEmail); return; }
    if (notifyPhone.replace(/[^0-9]/g, "").length < 10) { setErr(op.need); return; }
    if (!services.some((s) => s.name.trim())) {
      const warn = {
        pt: "Sem serviços/preços a Gui não consegue COTAR nem fechar. Quer salvar mesmo assim?",
        en: "Without services/prices the Gui can't QUOTE or close. Save anyway?",
        es: "Sin servicios/precios la Gui no puede COTIZAR ni cerrar. ¿Guardar igual?",
        hi: "सेवाओं/कीमतों के बिना Gui कोट या क्लोज़ नहीं कर सकती। फिर भी सेव करें?",
      }[lang] || "Without services/prices the Gui can't quote or close. Save anyway?";
      if (!window.confirm(warn)) return;
    }
    setErr(""); setState("go"); setResult(null);
    try {
      const body = { action: "save", mode, draft: assemble() };
      if (mode === "seller" && seller) { body.seller_email = seller.email; body.seller_code = seller.code || ""; body.seller = { name: seller.name, email: seller.email, ref: seller.ref }; }
      else if (token) body.token = token;
      const r = await fetch("/api/onboard-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      // 🚨 SUCESSO PRECISA DE COMPROVANTE: só é "salvo" com o id do que foi criado na resposta.
      if (r.ok && d && d.id) {
        setState("done"); setResult(d); try { localStorage.removeItem(LS_KEY); } catch { /* */ }
        onSaved && onSaved(d);
      } else { setState("err"); setErr((d && d.error) || t.errNet); }
    } catch { setState("err"); setErr(t.errNet); }
  };

  // ── AS ETAPAS ───────────────────────────────────────────────────────────────────────────────
  // Ordem deliberada: e-mail primeiro (pesquisa), depois o que o vendedor já sabe de cabeça,
  // SERVIÇOS antes de PRODUTOS (a sugestão de produto lê os serviços), e a revisão por último.
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail.trim());
  const phoneOk = notifyPhone.replace(/[^0-9]/g, "").length >= 10;

  const STEPS = [
    { k: "email", q: t.qEmail, h: t.hEmail, ok: emailOk },
    { k: "biz", q: t.qBiz, h: t.hBiz, ok: !!business.trim() },
    { k: "owner", q: t.qPhone, h: op.hint, ok: phoneOk },
    { k: "vert", q: t.qVert, h: t.hVert, ok: true },
    { k: "desc", q: t.qDesc, h: t.hDesc, ok: true },
    { k: "svc", q: t.qServices, h: t.hServices, ok: true },
    { k: "prod", q: t.qProducts, h: t.hProducts, ok: true },
    { k: "place", q: t.qPlace, h: t.hPlace, ok: true },
    { k: "agent", q: t.qAgent, h: t.hAgent, ok: true },
    { k: "brand", q: t.qBrand, h: t.hBrand, ok: true },
    { k: "number", q: t.qNumber, h: t.hNumber, ok: true },
    { k: "channels", q: t.qChannels, h: t.hChannels, ok: true },
    { k: "plan", q: t.qPlan, h: "", ok: true },
    { k: "review", q: t.qReview, h: t.hReview, ok: emailOk && !!business.trim() && phoneOk },
  ];
  const N = STEPS.length;
  const cur = STEPS[step] || null;

  const goTo = (i) => {
    const n = Math.max(-1, Math.min(N - 1, i));
    setStep(n); setMaxSeen((m) => Math.max(m, n)); setErr("");
    try { topRef.current && topRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { /* */ }
  };
  const next = () => { if (cur && !cur.ok) { setErr(cur.k === "email" ? t.needEmail : cur.k === "biz" ? t.needBiz : op.need); return; } goTo(step + 1); };
  const onKey = (e) => { if (e.key === "Enter" && cur && cur.k !== "desc") { e.preventDefault(); next(); } };

  // ── DONE ────────────────────────────────────────────────────────────────────────────────────
  if (state === "done") {
    return (
      // mesma regra do passo: a confirmação (com o id do rascunho) não pode depender de rAF
      <div className="rounded-2xl border border-g-green/30 bg-g-green/[0.06] p-7 text-center">
        <div className="text-4xl">🌱</div>
        <div className="mt-3 text-lg font-black text-g-word">{t.okTitle}</div>
        <p className="mt-1 text-[13px] text-g-muted max-w-md mx-auto">{t.okSub}</p>
        {/* o comprovante: o id que o servidor devolveu. "ok" sem id é promessa sem lastro. */}
        {result?.id && <div className="mt-2 font-mono text-[11.5px] text-g-muted/80">{t.draftId} {String(result.id)}</div>}
        {result?.widget_snippet && (
          <div className="mt-5 text-left rounded-xl border border-white/10 bg-[#0d0c0a]/50 p-4">
            <div className="text-[11px] font-black uppercase tracking-wide text-g-gold">{t.widgetSnippet}</div>
            <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[11.5px] leading-relaxed text-g-ink">{result.widget_snippet}</pre>
            <button onClick={() => { try { navigator.clipboard.writeText(result.widget_snippet); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ } }} className="btn-ghost text-[13px] mt-3">{copied ? t.copied : t.copy}</button>
          </div>
        )}
        {/* 💳 CLOSE THE MONEY — o vendedor manda o link de pagamento aqui, sem esperar o Luis. */}
        {(() => {
          const p = planByKey(plan);
          const ref = (seller && (seller.ref || seller.email)) || "";
          const url = payLink(clientEmail, ref);
          const waTxt = {
            pt: `Fechado! 🌱 Pra ativar a sua Gui (${p.name} · ${p.price}) é só concluir o pagamento aqui: ${url} — ela nasce automaticamente e você recebe o acesso por email em minutos.`,
            en: `Done! 🌱 To activate your Gui (${p.name} · ${p.price}) just complete the payment here: ${url} — it's born automatically and your access arrives by email in minutes.`,
            es: `¡Listo! 🌱 Para activar tu Gui (${p.name} · ${p.price}) solo completa el pago aquí: ${url} — nace automáticamente y tu acceso llega por email en minutos.`,
            hi: `हो गया! 🌱 अपनी Gui (${p.name} · ${p.price}) एक्टिवेट करने के लिए यहाँ पेमेंट पूरा करें: ${url} — यह अपने आप बनती है और एक्सेस मिनटों में ईमेल पर आता है।`,
          }[lang] || "";
          const label = { pt: "💳 Fechar a venda — mandar o link de pagamento", en: "💳 Close the sale — send the payment link", es: "💳 Cerrar la venta — enviar el link de pago", hi: "💳 बिक्री पूरी करें — पेमेंट लिंक भेजें" }[lang] || "💳 Send payment link";
          return (
            <div className="mt-5 rounded-xl border border-g-green/30 bg-g-green/[0.06] p-4 text-left">
              <div className="text-[11px] font-black uppercase tracking-wide text-g-green">{label}</div>
              <div className="mt-1 text-[13px] text-g-muted">{p.name} · {p.price} · {clientEmail || t.none}</div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <a href={`https://wa.me/?text=${encodeURIComponent(waTxt)}`} target="_blank" rel="noopener"
                  className="inline-flex min-h-[48px] items-center rounded-full bg-g-green/15 px-4 text-[14px] font-bold text-g-green ring-1 ring-g-green/30 hover:bg-g-green/25">💬 WhatsApp</a>
                <button type="button" onClick={() => { try { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ } }}
                  className="inline-flex min-h-[48px] items-center rounded-full border border-white/15 px-4 text-[14px] font-bold text-g-ink hover:text-g-word">{copied ? t.copied : "📋 " + t.copy}</button>
              </div>
            </div>
          );
        })()}
        <button onClick={() => { setState("idle"); setResult(null); setStep(-1); }} className="btn-bright text-[14px] mt-5">{t.newOne}</button>
      </div>
    );
  }

  // ── BOAS-VINDAS: não pergunta NADA (pergunta aqui custa −5% de conclusão) ───────────────────
  if (step < 0) {
    return (
      <div ref={topRef} className="card p-6 sm:p-8">
        <div className="eyebrow text-[10px]">{t.eyebrow}</div>
        <h2 className="mt-2 text-2xl font-black text-g-word">🌱 {t.title}</h2>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-g-muted">{t.welcomeSub}</p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {resumable ? (
            <>
              <button type="button" onClick={() => applyResume(resumable)} className="btn-bright min-h-[48px] text-[15px]">↩︎ {t.resume}</button>
              <button type="button" onClick={() => { dropResume(); goTo(0); }} className="inline-flex min-h-[48px] items-center rounded-full border border-white/15 px-4 text-[14px] font-bold text-g-muted hover:text-g-word">{t.restart}</button>
            </>
          ) : (
            <button type="button" onClick={() => goTo(0)} className="btn-bright min-h-[48px] text-[15px]">{t.start} →</button>
          )}
        </div>
        {resumable && <p className="mt-2.5 text-[12.5px] text-g-muted/80">{t.resumeFound} {resumable.data?.business ? `— ${resumable.data.business}` : ""}</p>}
      </div>
    );
  }

  // ── UMA PERGUNTA POR TELA ───────────────────────────────────────────────────────────────────
  return (
    <div ref={topRef} className="space-y-4">
      {/* progresso: "passo N de M" + trilha tocável nas etapas já visitadas. NUNCA porcentagem. */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] font-black uppercase tracking-wider text-g-gold">{t.stepOf(step + 1, N)}</span>
          {/* só diz "salvo" quando há resposta de verdade guardada — "salvo" sobre nada é ruído */}
          {savedAt && (clientEmail.trim() || business.trim()) && <span className="text-[11.5px] text-g-muted/75">✓ {t.savedLocal}</span>}
        </div>
        <div className="mt-2 flex gap-1">
          {STEPS.map((s, i) => (
            /* a barra tem 8px de altura, mas o ALVO tem 24: dedo não acerta traço de 8px. */
            <button key={s.k} type="button" disabled={i > maxSeen} onClick={() => goTo(i)} aria-label={s.q}
              className={`flex h-6 flex-1 items-center ${i > maxSeen ? "cursor-default" : "cursor-pointer"}`}>
              <span className={`h-2 w-full rounded-full transition ${i === step ? "bg-g-gold" : i <= maxSeen ? "bg-g-gold/35" : "bg-white/10"}`} />
            </button>
          ))}
        </div>
      </div>

      {/* ⚠️ O PASSO NÃO ANIMA — DE PROPÓSITO, E ISSO É UM CONSERTO, NÃO PREGUIÇA.
          A primeira versão usava <AnimatePresence mode="wait"> com entrada `opacity:0 → 1`. Eu MEDI
          na tela: com a aba fora de foco o requestAnimationFrame congela, a animação para no meio e
          o cartão fica em `opacity: 0` — a pergunta inteira INVISÍVEL, e com `mode="wait"` o passo
          seguinte nem chega a montar. É a mesma armadilha que já congelou o contador do relatório,
          só que aqui ela apaga o formulário: o vendedor sai pra ver o WhatsApp do cliente, volta, e
          encontra uma tela em branco no meio do cadastro.
          Regra que fica: conteúdo NUNCA nasce dependendo de uma animação terminar. */}
      <div>
        <div key={cur.k} className="card p-5 sm:p-6" onKeyDown={onKey}>
          <h3 className="text-[19px] font-black leading-snug text-g-word">{cur.q}</h3>
          {cur.h && <p className="mt-1.5 text-[13.5px] leading-relaxed text-g-muted">{cur.h}</p>}
          <div className="mt-4">

            {cur.k === "email" && (
              <>
                <input autoFocus type="email" inputMode="email" autoComplete="email" value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)} className={inp} placeholder="cliente@email.com" />
                {prefill?.email && <p className="mt-1.5 text-[12px] text-g-green">✓ {t.fromFollowup}</p>}
              </>
            )}

            {cur.k === "biz" && (
              <>
                <input autoFocus value={business} onChange={(e) => setBusiness(e.target.value)} className={inp} placeholder="New York Pão de Queijo" />
                {prefill?.business && <p className="mt-1.5 text-[12px] text-g-green">✓ {t.fromFollowup}</p>}
              </>
            )}

            {cur.k === "owner" && (
              <input autoFocus type="tel" inputMode="tel" value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} className={inp} placeholder="+1 305 555 0100" />
            )}

            {cur.k === "vert" && (
              <div className="flex flex-wrap gap-2">
                {VERTICAL_KEYS.map((k) => (
                  <button key={k} type="button" onClick={() => toggleVertical(k)} aria-pressed={verticals.includes(k)} className={chip(verticals.includes(k))}>
                    {VERTICALS[k]?.icon} {vertLabel(k, lang)}
                  </button>
                ))}
              </div>
            )}

            {cur.k === "desc" && (
              <textarea autoFocus value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inp} />
            )}

            {cur.k === "svc" && (
              <div className="space-y-2.5">
                {services.map((s, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center gap-2">
                      <input value={s.name} onChange={(e) => setSvc(i, { name: e.target.value })} className={inp} placeholder={t.svcName} />
                      {services.length > 1 && <button type="button" onClick={() => setServices((a) => a.filter((_, j) => j !== i))} className="min-h-[48px] min-w-[44px] text-[20px] text-g-muted hover:text-[#e0855f]">×</button>}
                    </div>
                    {/* rótulo ACIMA, não placeholder: a 375px "Depósito $" era cortado em "Depósit"
                        dentro de três colunas — e placeholder some quando o campo é preenchido. */}
                    <div className="mt-2 grid gap-2 grid-cols-2">
                      <div><div className={lbl}>{t.svcPrice}</div><input inputMode="decimal" value={s.price} onChange={(e) => setSvc(i, { price: e.target.value })} className={inp + " mt-1"} /></div>
                      <div><div className={lbl}>{t.svcDur}</div><input type="number" min="0" step="5" value={s.duration_min} onChange={(e) => setSvc(i, { duration_min: e.target.value })} className={inp + " mt-1"} /></div>
                      <div className="col-span-2"><div className={lbl}>{t.svcDeposit} <span className="text-g-muted/60">({t.optional})</span></div><input inputMode="decimal" value={s.deposit} onChange={(e) => setSvc(i, { deposit: e.target.value })} className={inp + " mt-1"} /></div>
                    </div>
                    <select value={svcVert(s)} onChange={(e) => setSvc(i, { vertical: e.target.value })} className={sel + " mt-2"}>
                      {VERTICAL_KEYS.map((k) => <option key={k} value={k} className="bg-[#161512]">{vertLabel(k, lang)}</option>)}
                    </select>
                  </div>
                ))}
                <button type="button" onClick={() => setServices((a) => [...a, newService()])} className="min-h-[48px] w-full rounded-xl border border-dashed border-white/20 text-[14px] font-bold text-g-muted hover:text-g-word">{t.addService}</button>
              </div>
            )}

            {cur.k === "prod" && (
              <OnboardProducts lang={lang} selected={products} suggested={suggested} onToggle={toggleProduct} onSet={setProducts} />
            )}

            {cur.k === "place" && (
              <div className="space-y-3">
                {locations.map((l, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-bold text-g-word">{t.unit} {i + 1}</div>
                      {locations.length > 1 && <button type="button" onClick={() => setLocations((a) => a.filter((_, j) => j !== i))} className="min-h-[44px] text-[13px] text-g-muted hover:text-[#e0855f]">{t.remove}</button>}
                    </div>
                    <input value={l.address} onChange={(e) => setLoc(i, { address: e.target.value })} className={inp + " mt-2"} placeholder={t.uAddress} />
                    {/* nome e telefone da unidade NÃO são perguntados: o nome nasce igual ao do negócio
                        (pré-preenchido e visível) e o telefone só aparece com mais de uma unidade. */}
                    <input value={l.name} onChange={(e) => setLoc(i, { name: e.target.value })} className={inp + " mt-2"} placeholder={business.trim() || t.uName} />
                    {locations.length > 1 && <input value={l.phone} onChange={(e) => setLoc(i, { phone: e.target.value })} className={inp + " mt-2"} placeholder={t.uPhone} />}
                    <select value={l.tz} onChange={(e) => setLoc(i, { tz: e.target.value })} className={sel + " mt-2"}>
                      {[...new Set([l.tz, ...TZ_OPTS])].filter(Boolean).map((z) => <option key={z} value={z} className="bg-[#161512]">{z}</option>)}
                    </select>
                    <div className="mt-3">
                      <div className={lbl}>{t.uHours}</div>
                      <div className="mt-2 space-y-1.5">
                        {l.hours.map((h) => (
                          /* flex-wrap + larguras curtas: a 375px a linha dia+aberto+09:00—18:00 estourava
                             a largura do cartão e o campo de FECHAR ficava cortado fora da tela. */
                          <div key={h.weekday} className="flex flex-wrap items-center gap-1.5 text-[14px]">
                            <span className="w-9 shrink-0 font-bold text-g-muted">{wd[h.weekday]}</span>
                            <button type="button" onClick={() => setHour(i, h.weekday, { closed: !h.closed })}
                              className={`min-h-[44px] shrink-0 rounded-full px-2.5 text-[12.5px] font-bold ${h.closed ? "bg-white/[0.06] text-g-muted ring-1 ring-white/10" : "bg-g-green/15 text-g-green ring-1 ring-g-green/30"}`}>
                              {h.closed ? t.closed : "✓"}
                            </button>
                            {!h.closed && (
                              <>
                                <input type="time" value={h.open} onChange={(e) => setHour(i, h.weekday, { open: e.target.value })} className="min-h-[44px] w-[86px] shrink-0 rounded-lg border border-white/15 bg-white/[0.05] px-1.5 text-[16px] text-g-word focus:outline-none focus:border-g-gold/60" />
                                <span className="text-g-muted">—</span>
                                <input type="time" value={h.close} onChange={(e) => setHour(i, h.weekday, { close: e.target.value })} className="min-h-[44px] w-[86px] shrink-0 rounded-lg border border-white/15 bg-white/[0.05] px-1.5 text-[16px] text-g-word focus:outline-none focus:border-g-gold/60" />
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => { const f = l.hours.find((x) => !x.closed); if (f) applyHoursToAll(i, f.open, f.close); }}
                        className="mt-2 min-h-[44px] text-[13px] font-bold text-g-gold">⇊ {t.allDays}</button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setLocations((a) => [...a, newLocation()])} className="min-h-[48px] w-full rounded-xl border border-dashed border-white/20 text-[14px] font-bold text-g-muted hover:text-g-word">{t.addUnit}</button>
              </div>
            )}

            {cur.k === "agent" && (
              <div className="space-y-3">
                <div><div className={lbl}>{t.agentName}</div><input autoFocus value={agentName} onChange={(e) => setAgentName(e.target.value)} className={inp + " mt-1"} placeholder="Lilian" /></div>
                <div>
                  <div className={lbl}>{t.voice}</div>
                  <select value={voiceKey} onChange={(e) => setVoiceKey(e.target.value)} className={sel + " mt-1"}>
                    {voices.map((v) => {
                      const k = v.key || v.id;
                      return <option key={k} value={k} className="bg-[#161512]">{[v.label || v.name || k, v.gender, v.vibe || v.style].filter(Boolean).join(" · ")}</option>;
                    })}
                  </select>
                  {selectedVoice && <p className="mt-1 text-[12.5px] text-g-muted">{selectedVoice.label || selectedVoice.name}</p>}
                </div>
                <div>
                  <div className={lbl}>{t.langs}</div>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {LANG_OPTS.map(([c, label]) => (
                      <button key={c} type="button" onClick={() => toggleLang(c)} aria-pressed={languages.includes(c)} className={chip(languages.includes(c))}>{label}</button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-g-muted/85">{t.langsNote}</p>
                </div>
                <div>
                  <div className={lbl}>{t.primaryLang}</div>
                  <select value={primaryLang} onChange={(e) => setPrimaryLang(e.target.value)} className={sel + " mt-1"}>
                    {LANG_OPTS.filter(([c]) => UI_LANGS.includes(c)).map(([c, label]) => <option key={c} value={c} className="bg-[#161512]">{label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {cur.k === "brand" && (
              <div className="space-y-3">
                <div><div className={lbl}>{t.logo}</div><input autoFocus value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={inp + " mt-1"} placeholder="https://…/logo.png" /></div>
                <div>
                  <div className={lbl}>{t.accent}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-12 w-14 shrink-0 cursor-pointer rounded-xl border border-white/15 bg-transparent" />
                    <input value={accent} onChange={(e) => setAccent(e.target.value)} className={inp + " w-32 font-mono"} />
                  </div>
                </div>
                {logoUrl.trim() && <img src={logoUrl} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-14 w-14 rounded-xl border border-white/10 object-contain bg-white/[0.04] p-1" />}
              </div>
            )}

            {cur.k === "number" && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-2">
                  {[["buy", t.phoneBuy], ["map", t.phoneMap], ["none", t.phoneNone]].map(([v, label]) => (
                    <button key={v} type="button" onClick={() => setPhone((p) => ({ ...p, mode: v }))} aria-pressed={phone.mode === v} className={chip(phone.mode === v)}>{label}</button>
                  ))}
                </div>
                {phone.mode === "buy" && <input value={phone.area_code} onChange={(e) => setPhone((p) => ({ ...p, area_code: e.target.value }))} className={inp} placeholder={t.areaCode} inputMode="numeric" />}
                {phone.mode === "map" && <input value={phone.existing_number} onChange={(e) => setPhone((p) => ({ ...p, existing_number: e.target.value }))} className={inp} placeholder={t.existingNum} inputMode="tel" />}
                {showForward ? (
                  <input value={phone.forward} onChange={(e) => setPhone((p) => ({ ...p, forward: e.target.value }))} className={inp} placeholder={t.forward} inputMode="tel" />
                ) : (
                  <button type="button" onClick={() => setShowForward(true)} className="min-h-[44px] text-[13.5px] font-bold text-g-gold">+ {t.forward} <span className="text-g-muted/70">({t.optional})</span></button>
                )}
              </div>
            )}

            {cur.k === "channels" && (
              <div className="space-y-2">
                {chList.map((ch, idx) => {
                  const key = keyOf(ch);
                  if (!key || key === "phone") return null; // o telefone tem tela própria
                  const isLive = liveKeys.has(key) ? true : pendKeys.has(key) ? false : ch.status ? ch.status === "live" : key === "widget" || key === "email" || key === "sms";
                  const label = chLabel[key] || CH_LABEL.en[key] || key;
                  const icon = ch.emoji || ch.icon || CH_ICON[key] || "•";
                  const on = key === "widget" ? widgetEnabled : key === "ads" ? adsEnabled : !!chOn[key];
                  const flip = () => {
                    if (key === "widget") setWidgetEnabled((v) => !v);
                    else if (key === "ads") setAdsEnabled((v) => !v);
                    else setChOn((m) => ({ ...m, [key]: !m[key] }));
                  };
                  const hasField = CH_FIELD[key] && key !== "widget" && key !== "ads";
                  return (
                    <div key={key + idx} className={`rounded-xl border p-2.5 ${on ? "border-g-green/35 bg-g-green/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
                      <button type="button" onClick={flip} aria-pressed={on} className="flex min-h-[44px] w-full items-center gap-2 text-left">
                        <span className="text-[16px]">{icon}</span>
                        <span className="text-[14px] font-bold text-g-word">{label}</span>
                        <span className="ml-auto flex items-center gap-2">
                          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-black" style={isLive ? { background: "rgba(62,148,104,0.16)", color: "#5EC26A" } : { background: "rgba(217,164,65,0.14)", color: "#D9A441" }}>{isLive ? t.live : t.pending}</span>
                          <span className={`text-[16px] ${on ? "text-g-green" : "text-g-muted/50"}`}>{on ? "✓" : "+"}</span>
                        </span>
                      </button>
                      {on && hasField && (
                        <input value={chText[key] || ""} onChange={(e) => setChText((m) => ({ ...m, [key]: e.target.value }))} className={inp + " mt-2"} placeholder={ch.placeholder || CH_PH[key] || ""} />
                      )}
                    </div>
                  );
                })}
                {showExtras ? (
                  <div className="grid gap-2 pt-1 sm:grid-cols-2">
                    <div><div className={lbl}>{t.supportLink}</div><input value={supportLink} onChange={(e) => setSupportLink(e.target.value)} className={inp + " mt-1"} placeholder="https://…" /></div>
                    <div><div className={lbl}>{t.reviewLink}</div><input value={reviewLink} onChange={(e) => setReviewLink(e.target.value)} className={inp + " mt-1"} placeholder="https://g.page/…" /></div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowExtras(true)} className="min-h-[44px] text-[13.5px] font-bold text-g-gold">+ {t.supportLink} · {t.reviewLink} <span className="text-g-muted/70">({t.optional})</span></button>
                )}
              </div>
            )}

            {cur.k === "plan" && (
              <div className="space-y-2.5">
                {GUILEO_PLANS.map((p) => {
                  const on = plan === p.key;
                  return (
                    <button key={p.key} type="button" onClick={() => { setPlan(p.key); setCredits(planByKey(p.key).credits); }} aria-pressed={on}
                      className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition ${on ? "bg-g-gold/[0.14] ring-2 ring-g-gold/60" : "border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                      <div className="flex-1">
                        <div className="text-[15px] font-black text-g-word">{p.name}</div>
                        <div className="text-[13px] text-g-muted">{p.price} · {p.credits} {t.credits.toLowerCase()} {t.included}</div>
                      </div>
                      {on && <span className="text-[17px] text-g-gold">✓</span>}
                    </button>
                  );
                })}
                {/* créditos nascem do plano — visível, não perguntado (pré-preenchido: +4,8%) */}
                {editCredits ? (
                  <div><div className={lbl}>{t.credits}</div><input type="number" min="0" value={credits} onChange={(e) => setCredits(e.target.value)} className={inp + " mt-1"} /></div>
                ) : (
                  <button type="button" onClick={() => setEditCredits(true)} className="min-h-[44px] text-[13.5px] text-g-muted">{t.credits}: <b className="text-g-word">{credits}</b> <span className="text-g-gold">✎</span></button>
                )}
              </div>
            )}

            {cur.k === "review" && (
              <div className="space-y-2.5 text-[14px]">
                {[
                  [t.clientEmail, clientEmail, 0], [t.bizName, business, 1], [op.label, notifyPhone, 2],
                  [t.verticals, verticals.map((k) => vertLabel(k, lang)).join(" · "), 3],
                  [t.bizDesc, description, 4],
                  [t.qServices, services.filter((s) => s.name.trim()).map((s) => `${s.name}${s.price ? ` $${s.price}` : ""}`).join(" · "), 5],
                  [t.products, products.length ? `${products.length} ${t.pickedN}` : t.noProducts, 6],
                  [t.uAddress, locations.map((l) => l.address).filter(Boolean).join(" · "), 7],
                  [t.agentName, [agentName.trim() || t.none, selectedVoice?.label || selectedVoice?.name].filter(Boolean).join(" · "), 8],
                  [t.logo, logoUrl, 9],
                  [t.qNumber, phone.mode === "buy" ? `${t.phoneBuy} ${phone.area_code}` : phone.mode === "map" ? `${t.phoneMap} ${phone.existing_number}` : t.phoneNone, 10],
                  [t.qPlan, `${planByKey(plan).name} · ${credits} ${t.credits.toLowerCase()}`, 12],
                ].map(([k, v, i]) => (
                  <button key={k} type="button" onClick={() => goTo(i)} className="flex min-h-[48px] w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-2 text-left hover:bg-white/[0.04] sm:flex-nowrap sm:items-start">
                    <span className="w-full text-[12px] font-bold uppercase leading-snug tracking-wide text-g-muted sm:w-32 sm:shrink-0">{k}</span>
                    <span className="min-w-0 flex-1 break-words text-g-word">{v || t.none}</span>
                    <span className="shrink-0 text-g-gold">✎</span>
                  </button>
                ))}
                {/* equipe é o último opcional — só existe se o vendedor abrir */}
                <div className="pt-1">
                  <div className={lbl}>{t.team} <span className="text-g-muted/70">({t.optional})</span></div>
                  <div className="mt-2 space-y-2">
                    {team.map((m, i) => (
                      <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <input value={m.name} onChange={(e) => setMem(i, { name: e.target.value })} className={inp} placeholder={t.mName} />
                        <input value={m.title} onChange={(e) => setMem(i, { title: e.target.value })} className={inp} placeholder={t.mTitle} />
                        <button type="button" onClick={() => setTeam((a) => a.filter((_, j) => j !== i))} className="min-h-[48px] min-w-[44px] text-[20px] text-g-muted hover:text-[#e0855f]">×</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setTeam((a) => [...a, newMember()])} className="min-h-[48px] w-full rounded-xl border border-dashed border-white/20 text-[14px] font-bold text-g-muted hover:text-g-word">{t.addMember}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {err && <div className="mt-3 text-[14px] text-[#e0855f]">{err}</div>}

          {/* navegação — alvos ≥48px, o par sempre no mesmo lugar em toda etapa */}
          <div className="mt-5 flex items-center gap-2.5">
            <button type="button" onClick={() => goTo(step - 1)}
              className="inline-flex min-h-[48px] items-center rounded-full border border-white/15 px-4 text-[14px] font-bold text-g-muted hover:text-g-word">← {t.back}</button>
            {cur.k === "review" ? (
              <button type="button" onClick={submit} disabled={state === "go"} className="btn-bright ml-auto min-h-[48px] text-[15px] disabled:opacity-60">
                {state === "go" ? t.submitting : `🌱 ${t.finish}`}
              </button>
            ) : (
              <button type="button" onClick={next} className="btn-bright ml-auto min-h-[48px] text-[15px]">{t.next} →</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
