import { useState, useEffect } from "react";
import { useLang } from "../i18n.jsx";
import ConsentText from "./ConsentText.jsx";
import guileoMark from "../assets/guileo-mark.png";

// Live platform CX — real aggregate from the XM engine (/api/pulse-stat → cx_platform_pulse).
// Only surfaces once it's backed by enough real data; otherwise the section stays fully static.
// Two tiers of honesty: once there's enough data (ready) we show the AVG CX; below that floor,
// if any business is already measuring we show the real COUNTS (never a misleading average).
const LIVE_LABEL = {
  en: (cx, b) => `Live: avg CX ${cx} across ${b} Guileo businesses measuring right now`,
  pt: (cx, b) => `Ao vivo: CX médio ${cx} em ${b} negócios Guileo medindo agora`,
  es: (cx, b) => `En vivo: CX promedio ${cx} en ${b} negocios Guileo midiendo ahora`,
  hi: (cx, b) => `लाइव: ${b} Guileo व्यवसायों में औसत CX ${cx}, अभी माप रहे हैं`,
};
const LIVE_COUNT = {
  en: (s, b) => `Live: ${s} customer experiences measured across ${b} Guileo business${b > 1 ? "es" : ""}`,
  pt: (s, b) => `Ao vivo: ${s} experiências de clientes medidas em ${b} negócio${b > 1 ? "s" : ""} Guileo`,
  es: (s, b) => `En vivo: ${s} experiencias de clientes medidas en ${b} negocio${b > 1 ? "s" : ""} Guileo`,
  hi: (s, b) => `लाइव: ${b} Guileo व्यवसाय${b > 1 ? "ों" : ""} में ${s} ग्राहक अनुभव मापे गए`,
};


// ── O PISO DO CONTADOR AO VIVO (2026-08-11) ─────────────────────────────────────────────────────
// Este selo estava anunciando, em produção: "Live: 16 customer experiences measured across 2
// Guileo businesses". Verdade — e CONTRAPROVA. Um contador ao vivo só é prova social se o número
// impressiona; abaixo de um piso, o mesmo número honesto vira o argumento do concorrente ("olha,
// ninguém usa"). O visitante não lê "estamos começando", lê "não pegou".
//
// O componente JÁ tinha esse conceito e o aplicava só na média (`ready` = dados suficientes para
// uma média não enganosa). O buraco era a camada de CONTAGEM, que disparava com `> 0` — qualquer
// coisa acima de zero virava manchete. Aqui o piso é o mesmo raciocínio, aplicado ao número que
// fala de ESCALA em vez de precisão.
//
// A saída NÃO é inflar nem esconder para sempre: o selo volta sozinho quando o número virar
// argumento, sem ninguém editar nada. Enquanto isso a seção se sustenta no que já é forte e não
// depende de escala — a comparação de preço ($49 fixo contra $300–600 por unidade).

// ── O PAINEL DO PULSE, MOSTRADO EM VEZ DE DESCRITO (Luis, 2026-08-11) ───────────────────────────
// «um termômetro de satisfação, pesquisas e avaliação de 1 a 5 estrelas — ISSO é o serviço; tem
// que estar VISÍVEL e casar com o design.»
// Eu tinha cortado os 4 cartões que EXPLICAVAM o produto, e o corte estava certo: texto explicando
// não vende um produto visual. O que faltava não era texto menor — era o produto APARECENDO.
// Este bloco é o painel que o dono vê: o termômetro (a nota), a distribuição de estrelas (de onde
// a nota vem) e a pergunta que o cliente dele responde (como a nota é coletada). Três peças, uma
// linha, zero parágrafo.
//
// HONESTIDADE: estes números são EXEMPLO, e o rótulo diz isso na cara — não são média de cliente
// nenhum. O selo "ao vivo" desta seção continua sendo a única coisa que fala de dados reais, e ele
// só aparece acima do piso (ver PISO_NEGOCIOS/PISO_SINAIS). Painel de demonstração e alegação de
// resultado são coisas diferentes; misturar as duas é como o "40%" que saiu daqui.
// EXPORTADO (2026-08-18): o Growth Report (/apresentacao/:id) desenha o MESMO termômetro, as
// MESMAS estrelas e a MESMA pesquisa — Luis: «trazer aquele mesmo termômetro… tem que ser melhor
// que a Qualtrics». Reescrever os rótulos lá seria a segunda fonte de sempre; aqui é a única.
export const PAINEL = {
  en: { tag: "What you get, every week", score: "Your CX score", ex: "example panel",
        stars: "Where the score comes from", ask: "What your customer is asked", q: "How was your visit today?", send: "Tap to answer" },
  pt: { tag: "O que você recebe, toda semana", score: "Sua nota de satisfação", ex: "painel de exemplo",
        stars: "De onde a nota vem", ask: "O que o seu cliente responde", q: "Como foi seu atendimento hoje?", send: "Toque para responder" },
  es: { tag: "Lo que recibes, cada semana", score: "Tu nota de satisfacción", ex: "panel de ejemplo",
        stars: "De dónde viene la nota", ask: "Lo que responde tu cliente", q: "¿Cómo fue tu atención hoy?", send: "Toca para responder" },
  hi: { tag: "हर हफ़्ते आपको क्या मिलता है", score: "आपका CX स्कोर", ex: "उदाहरण पैनल",
        stars: "स्कोर कहाँ से आता है", ask: "आपके ग्राहक से क्या पूछा जाता है", q: "आज आपका अनुभव कैसा रहा?", send: "जवाब देने के लिए टैप करें" },
};
// distribuição de exemplo (5★ → 1★). Soma 100 de propósito: é leitura de percentual.
// ── A PORTA PARA /pulse (2026-08-12) ───────────────────────────────────────────────────────────
// Criei a página /pulse e ela nasceu ÓRFÃ: nenhum link, fora do sitemap. Página que existe não é
// página que se alcança — é a mesma família do "sucesso sem comprovante" que persegui a sessão
// inteira, e a mais fácil de não notar, porque `curl /pulse` devolve 200 alegremente.
// Duas portas, e são para públicos diferentes: o SITEMAP é a do Google, o LINK abaixo é a do
// visitante que quer entender o produto antes de dar o telefone. Faltar qualquer uma das duas
// deixa a página existindo para ninguém.
const VER_MAIS = {
  en: "See how Pulse works →", pt: "Veja como o Pulse funciona →",
  es: "Mira cómo funciona Pulse →", hi: "देखें Pulse कैसे काम करता है →",
};
// ── POR QUE OS NÚMEROS DE EXEMPLO SAÍRAM DO PAINEL (2026-08-20) ─────────────────────────────────
// O painel ANTES era estático: nota 86 e a distribuição 68/21/6/3/2. Agora ele SE MOVE (o arco
// enche e esvazia, as barras cascateiam, a carinha segue a leitura) — é a versão que o Luis
// aprovou no relatório. E aí um número fixo ao lado de uma forma que muda vira mentira sozinho:
// enquanto o arco passa por "terrível", o 86 continua lá dizendo o contrário; enquanto a barra de
// 5★ esvazia, o "68%" ao lado dela afirma o que a barra está negando.
// Então o instrumento fala por forma: a CARINHA é a leitura do arco, as barras não têm percentual.
// O selo "painel de exemplo" (PAINEL.ex) CONTINUA — junto com o selo ▶ simulação e a frase
// `simNote` —, porque quem chega aqui é desconhecido e precisa saber que aquilo não é medição de
// ninguém. Ver a mesma trava, com o motivo inverso, em RelatorioEspelho.jsx → PulsePresente.
// Zero contador numérico: aba em segundo plano congela o rAF e imprime número falso (já aconteceu
// neste repo). Aqui só há keyframe CSS de FORMA — congelar uma forma não inventa dado.
const GOLD = "#D6C29A", GOLD_RGB = "214,194,154";

const PISO_NEGOCIOS = 10;   // abaixo disso "N negócios" conta contra nós
const PISO_SINAIS = 500;    // idem para o volume de experiências medidas

// PulseSection — landing wedge for GUILEO PULSE, a standalone product:
// "the Qualtrics of the small business, run by AI". It MEASURES the satisfaction of the
// customer-of-the-customer from signals Gui already captures (call sentiment + reviews,
// passive) plus NPS/CSAT/CES (active), computes a CX score + drivers + detractors, and
// 🚨 MOEDA: DÓLAR SEMPRE (2026-08-20). O R$149 saiu junto com os planos: não existe checkout em
// real no site inteiro — quem clicasse era cobrado em dólar pelo Stripe. Preço sem caminho de
// pagamento é intenção, não preço. Volta quando o checkout em BRL existir.
// CLOSES THE LOOP on unhappy customers. Wedge = a FLAT $49/mo vs the
// per-location incumbents (Birdeye/Podium) and enterprise (Medallia/Qualtrics).
//
// Self-contained: local dict keyed by `lang` from useLang() (same pattern as GrowthV2 /
// LeadCaptureV2). Landing design system only (g-* tokens, shadow-lift).
// RAIO: cartão = rounded-2xl (o mesmo dos pilares e de toda a narrativa da página); rounded-xl3
// fica só para PAINEL largo. A linha anterior deste comentário dizia que xl3 era "o sistema" —
// não era, e foi seguindo o comentário que esta seção acabou com cara de outro site.
// CTA reuses the site's phone-input "AI calls you" flow (/api/lead noCall + /api/call).

// EXPORTADO: a página /pulse consome ESTE dicionário. O conteúdo que saiu da landing (os 4 cartões
// de benefício e a faixa dos 40%) continua vivo aqui e é renderizado lá — nenhuma linha foi copiada.
// Copiar teria criado a 2ª fonte que passei a sessão inteira eliminando: no dia em que um número
// mudar, o certo é mudar num lugar só. Ver [[project_guileo_landing_pillars]].
export const PULSE_COPY = {
  en: {
    eyebrow: "GUILEO PULSE",
    category: "Experience Management · small-business price",
    h1a: "Measure how your customers ",
    h1b: "really feel",
    h1c: " — automatically.",
    sub: "Enterprise-grade experience management, already running — because Gui is already on the calls. No surveys to build, no per-location bill.",
    benefits: [
      { ic: "🎯", t: "One number, from the calls you already get", d: "Every call Gui answers gets read for how the customer felt. That becomes one score. You build no surveys." },
      { ic: "🔎", t: "What's costing you customers this week", d: "The real reasons people leave unhappy — the wait, a short tone, a promise not kept — ranked by what each one costs you." },
      { ic: "🔁", t: "The unhappy customer gets a call back", d: "Someone hung up upset? Gui calls, apologizes and fixes it — while they're still yours." },
      { ic: "📊", t: "Ask them directly, when you want to", d: "Send a quick question after a visit if you like. What they answer and how they sounded feed the same number (NPS, CSAT and CES included)." },
    ],
    statBig: "40%",
    statText: "of customers who stopped responding said it's because nothing happened the last time they gave feedback.",
    statPunch: "Closing the loop is the whole game. Pulse does it for you.",
    compare: "Enterprise experience management. Small-business price.",
    us: "Pulse — $49/mo, flat",
    usSub: "every location included",
    rivals: [
      { n: "Birdeye · Podium", p: "$300–600 / location / mo" },
      { n: "Medallia · Qualtrics", p: "$20K+ / year" },
    ],
    price: "$49",
    per: "/mo · flat, all locations",
    degrau: "Start here for $49 — and it becomes credit on your plan when you're ready.",
    ctaLine: "See your Pulse score — Gui calls you now.",
    placeholder: "Your phone number",
    cta: "Call me",
    calling: "Calling…",
    done: "📞 Calling you now — pick up!",
    consent: "I agree to get one call from Gui (Guileo). Rates may apply; reply STOP to opt out.",
    consentErr: "Please check the box so Gui can call you.",
    foot: "No surveys to build · live in minutes · cancel anytime",
    // ── o mesmo argumento e os dois caminhos do relatório (ver a nota do componente) ──
    why: "Qualtrics has to send a survey and hope someone answers. Pulse reads how the customer felt in the conversations that already happened — every call the agent takes — and turns that into one number.",
    sim: "simulation",
    simNote: "The dial and the bars are moving to SHOW YOU THE INSTRUMENT — an example panel, not the reading of any real business.",
    ways: "Two ways in — you get both",
    way1: ["🎧", "Reads the conversations that already happened", "Every call the agent takes is scored for sentiment — nobody has to answer anything."],
    way2: ["✉️", "And it also sends the survey", "After the visit, a 1-tap survey goes out in your brand, capturing what the customer asked for and how it ended — and the result reports back to you."],
  },
  pt: {
    eyebrow: "GUILEO PULSE",
    category: "Gestão de Experiência · preço de pequeno negócio",
    h1a: "Meça como seus clientes ",
    h1b: "realmente se sentem",
    h1c: " — no automático.",
    sub: "Gestão de experiência nível enterprise, já rodando — porque a Gui já está nas ligações. Sem pesquisa pra montar, sem conta por unidade.",
    benefits: [
      { ic: "🎯", t: "Um número, das ligações que você já recebe", d: "Toda ligação que a Gui atende é lida pelo que o cliente sentiu. Isso vira uma nota só. Você não monta pesquisa nenhuma." },
      { ic: "🔎", t: "O que está te custando cliente nesta semana", d: "Os motivos reais de quem sai insatisfeito — a espera, um tom seco, uma promessa não cumprida — ranqueados pelo que cada um custa." },
      { ic: "🔁", t: "O cliente insatisfeito recebe uma ligação", d: "Alguém desligou chateado? A Gui liga, pede desculpa e resolve — enquanto ele ainda é seu." },
      { ic: "📊", t: "Pergunte direto, quando você quiser", d: "Mande uma pergunta rápida depois do atendimento, se quiser. O que a pessoa responde e como ela soou alimentam o mesmo número (NPS, CSAT e CES inclusos)." },
    ],
    statBig: "40%",
    statText: "dos clientes que pararam de responder disseram que foi porque nada aconteceu da última vez que deram um feedback.",
    statPunch: "Fechar o ciclo é o jogo inteiro. O Pulse faz isso por você.",
    compare: "Gestão de experiência enterprise. Preço de pequeno negócio.",
    us: "Pulse — US$ 49/mês, fixo",
    usSub: "todas as unidades incluídas",
    rivals: [
      { n: "Birdeye · Podium", p: "US$300–600 / unidade / mês" },
      { n: "Medallia · Qualtrics", p: "US$20K+ / ano" },
    ],
    price: "US$ 49",
    per: "/mês · fixo, todas as unidades",
    degrau: "Comece aqui por $49 — e ele vira crédito no seu plano quando você quiser subir.",
    ctaLine: "Veja seu score Pulse — a Gui te liga agora.",
    placeholder: "Seu número de telefone",
    cta: "Me ligar",
    calling: "Ligando…",
    done: "📞 Ligando pra você agora — atende!",
    consent: "Concordo em receber uma ligação da Gui (Guileo). Podem incidir tarifas; responda STOP pra sair.",
    consentErr: "Marque a caixa pra Gui poder te ligar.",
    foot: "Sem pesquisa pra montar · no ar em minutos · cancele quando quiser",
    why: "A Qualtrics precisa mandar uma pesquisa e torcer pra alguém responder. O Pulse lê como o cliente se sentiu nas conversas que JÁ aconteceram — em toda ligação que a agente atende — e transforma isso numa nota só.",
    sim: "simulação",
    simNote: "O ponteiro e as barras estão se movendo para MOSTRAR O INSTRUMENTO — é um painel de exemplo, não a medição de negócio nenhum.",
    ways: "Dois caminhos — você tem os dois",
    way1: ["🎧", "Lê as conversas que já aconteceram", "Toda ligação que a agente atende é pontuada por sentimento — ninguém precisa responder nada."],
    way2: ["✉️", "E também manda a pesquisa", "Depois do atendimento, sai uma pesquisa de 1 toque com a sua marca, capturando o que o cliente pediu e como terminou — e o resultado volta pra você."],
  },
  es: {
    eyebrow: "GUILEO PULSE",
    category: "Gestión de Experiencia · precio de pequeño negocio",
    h1a: "Mide cómo se sienten tus clientes ",
    h1b: "de verdad",
    h1c: " — en automático.",
    sub: "Gestión de experiencia nivel enterprise, ya funcionando — porque Gui ya está en las llamadas. Sin encuestas que armar, sin cobro por local.",
    benefits: [
      { ic: "🎯", t: "Un número, de las llamadas que ya recibes", d: "Cada llamada que Gui atiende se lee por lo que el cliente sintió. Eso se vuelve una sola nota. No armas ninguna encuesta." },
      { ic: "🔎", t: "Qué te está costando clientes esta semana", d: "Los motivos reales de quien se va molesto — la espera, un tono seco, una promesa incumplida — ordenados por lo que cada uno cuesta." },
      { ic: "🔁", t: "El cliente molesto recibe una llamada", d: "¿Alguien colgó molesto? Gui llama, se disculpa y lo resuelve — mientras todavía es tuyo." },
      { ic: "📊", t: "Pregunta directo, cuando quieras", d: "Manda una pregunta rápida después de la visita, si quieres. Lo que responde y cómo sonó alimentan el mismo número (NPS, CSAT y CES incluidos)." },
    ],
    statBig: "40%",
    statText: "de los clientes que dejaron de responder dijeron que fue porque nada pasó la última vez que dieron feedback.",
    statPunch: "Cerrar el ciclo es todo el juego. Pulse lo hace por ti.",
    compare: "Gestión de experiencia enterprise. Precio de pequeño negocio.",
    us: "Pulse — $49/mes, fijo",
    usSub: "todos los locales incluidos",
    rivals: [
      { n: "Birdeye · Podium", p: "US$300–600 / local / mes" },
      { n: "Medallia · Qualtrics", p: "US$20K+ / año" },
    ],
    price: "$49",
    per: "/mes · fijo, todos los locales",
    degrau: "Empieza aquí por $49 — y se vuelve crédito en tu plan cuando quieras subir.",
    ctaLine: "Ve tu score Pulse — Gui te llama ahora.",
    placeholder: "Tu número de teléfono",
    cta: "Llamarme",
    calling: "Llamando…",
    done: "📞 Llamándote ahora — ¡contesta!",
    consent: "Acepto recibir una llamada de Gui (Guileo). Pueden aplicar tarifas; responde STOP para salir.",
    consentErr: "Marca la casilla para que Gui pueda llamarte.",
    foot: "Sin encuestas que armar · en marcha en minutos · cancela cuando quieras",
    why: "Qualtrics tiene que mandar una encuesta y esperar que alguien responda. Pulse lee cómo se sintió el cliente en las conversaciones que YA ocurrieron — en cada llamada que atiende la agente — y lo convierte en una sola nota.",
    sim: "simulación",
    simNote: "La aguja y las barras se mueven para MOSTRARTE EL INSTRUMENTO — es un panel de ejemplo, no la medición de ningún negocio real.",
    ways: "Dos caminos — tienes los dos",
    way1: ["🎧", "Lee las conversaciones que ya ocurrieron", "Cada llamada que atiende la agente se puntúa por sentimiento — nadie tiene que responder nada."],
    way2: ["✉️", "Y también manda la encuesta", "Después de la visita sale una encuesta de 1 toque con tu marca, capturando lo que pidió el cliente y cómo terminó — y el resultado vuelve a ti."],
  },
  hi: {
    eyebrow: "GUILEO PULSE",
    category: "Experience Management · छोटे व्यवसाय की कीमत",
    h1a: "जानें आपके ग्राहक ",
    h1b: "सच में कैसा महसूस करते हैं",
    h1c: " — अपने-आप।",
    sub: "एंटरप्राइज़-स्तर का एक्सपीरियंस मैनेजमेंट, पहले से चालू — क्योंकि Gui पहले से कॉल पर है। कोई सर्वे नहीं बनाना, कोई प्रति-लोकेशन बिल नहीं।",
    benefits: [
      { ic: "🎯", t: "एक नंबर, उन्हीं कॉल्स से जो पहले से आती हैं", d: "गुई जो भी कॉल उठाती है, उसे ग्राहक की भावना के लिए पढ़ा जाता है। वही एक स्कोर बनता है। कोई सर्वे नहीं बनाना पड़ता।" },
      { ic: "🔎", t: "इस हफ़्ते आपको ग्राहक किस वजह से खो रहे हैं", d: "नाराज़ जाने की असली वजहें — इंतज़ार, रूखा लहजा, अधूरा वादा — इस क्रम में कि हर एक आपको कितना महँगा पड़ता है।" },
      { ic: "🔁", t: "नाराज़ ग्राहक को कॉल वापस जाती है", d: "कोई नाराज़ होकर फ़ोन रख गया? गुई कॉल करती है, माफ़ी माँगती है और ठीक करती है — जब तक वह आपका है।" },
      { ic: "📊", t: "जब चाहें, सीधे पूछिए", d: "चाहें तो विज़िट के बाद एक छोटा सवाल भेजिए। जवाब और आवाज़ का लहजा — दोनों उसी नंबर में जाते हैं (NPS, CSAT और CES शामिल)।" },
    ],
    statBig: "40%",
    statText: "ग्राहक जिन्होंने जवाब देना बंद किया, बोले कि पिछली बार फ़ीडबैक देने पर कुछ हुआ ही नहीं, इसीलिए।",
    statPunch: "लूप बंद करना ही पूरा खेल है। Pulse यह आपके लिए करता है।",
    compare: "एंटरप्राइज़ एक्सपीरियंस मैनेजमेंट। छोटे व्यवसाय की कीमत।",
    us: "Pulse — $49/माह, फ़्लैट",
    usSub: "हर लोकेशन शामिल",
    rivals: [
      { n: "Birdeye · Podium", p: "US$300–600 / लोकेशन / माह" },
      { n: "Medallia · Qualtrics", p: "US$20K+ / वर्ष" },
    ],
    price: "$49",
    per: "/माह · फ़्लैट, सभी लोकेशन",
    degrau: "यहाँ से $49 में शुरू करें — और तैयार होने पर यह आपके प्लान में क्रेडिट बन जाता है।",
    ctaLine: "अपना Pulse स्कोर देखें — Gui अभी आपको कॉल करती है।",
    placeholder: "आपका फ़ोन नंबर",
    cta: "मुझे कॉल करें",
    calling: "कॉल हो रही है…",
    done: "📞 अभी आपको कॉल कर रहे हैं — उठाइए!",
    consent: "मैं Gui (Guileo) से एक कॉल पाने के लिए सहमत हूँ। शुल्क लागू हो सकते हैं; ऑप्ट-आउट के लिए STOP भेजें।",
    consentErr: "बॉक्स चेक करें ताकि Gui आपको कॉल कर सके।",
    foot: "कोई सर्वे नहीं बनाना · मिनटों में लाइव · कभी भी रद्द करें",
    why: "Qualtrics को सर्वे भेजकर उम्मीद करनी पड़ती है कि कोई जवाब देगा। Pulse उन बातचीतों से पढ़ता है जो पहले ही हो चुकी हैं — हर उस कॉल से जो एजेंट उठाती है — और उसे एक स्कोर में बदल देता है।",
    sim: "सिमुलेशन",
    simNote: "डायल और बार सिर्फ़ यंत्र दिखाने के लिए चल रहे हैं — यह उदाहरण पैनल है, किसी असली व्यवसाय की माप नहीं।",
    ways: "दो रास्ते — दोनों आपको मिलते हैं",
    way1: ["🎧", "पहले हो चुकी बातचीत को पढ़ता है", "एजेंट जो भी कॉल उठाती है, उसका भाव स्कोर होता है — किसी को कुछ जवाब नहीं देना पड़ता।"],
    way2: ["✉️", "और सर्वे भी भेजता है", "सेवा के बाद आपके ब्रांड वाला 1-टैप सर्वे जाता है, जो ग्राहक की माँग और अंतिम अनुभव दर्ज करता है — और नतीजा आपके पास लौटता है।"],
  },
};

export default function PulseSection() {
  const { lang } = useLang();
  const G = PULSE_COPY[lang] || PULSE_COPY.en;

  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false); // TCPA — affirmative opt-in before any automated call
  const [err, setErr] = useState(false);
  const [st, setSt] = useState("idle"); // idle · calling · done
  const [live, setLive] = useState(null); // real platform CX pulse (null until fetched; {ready,avg_cx,businesses})

  useEffect(() => {
    let ok = true;
    fetch("/api/pulse-stat").then((r) => (r.ok ? r.json() : null)).then((d) => { if (ok) setLive(d || null); }).catch(() => {});
    return () => { ok = false; };
  }, []);
  // ⚠️ CHAMA-SE `PN`, NÃO `P`: o dicionário de idiomas deste arquivo JÁ é `const P` (linha ~82) e é
  // lido logo acima em `const G = P[lang]`. Declarar outro `P` aqui dentro criava uma SOMBRA no
  // mesmo escopo de função → zona morta temporal, e a linha de cima passava a ler a variável que
  // ainda não existe. O build compilou sem uma palavra; o erro só apareceu no navegador, e o
  // ErrorBoundary engoliu a seção INTEIRA em silêncio (a página seguia perfeita, sem o Pulse).
  // Duas lições numa: sombra de `const` é invisível ao compilador e ao olho quando as duas
  // declarações estão a 154 linhas de distância; e rede de proteção que esconde a queda é a mesma
  // família do fallback que vira zero — some com o sintoma e preserva a causa.
  const PN = PAINEL[lang] || PAINEL.en;
  const liveText = !live ? null
    : (live.ready && live.avg_cx > 0 && live.businesses > 0)
      ? (LIVE_LABEL[lang] || LIVE_LABEL.en)(live.avg_cx, live.businesses)     // enough data → show avg CX
      : (live.businesses >= PISO_NEGOCIOS && live.signals >= PISO_SINAIS)
        ? (LIVE_COUNT[lang] || LIVE_COUNT.en)(live.signals, live.businesses)  // dado real E suficiente
        : null;                                                              // abaixo do piso → fica calado

  const submit = async (e) => {
    e.preventDefault();
    if (!phone.trim() || !consent) { setErr(true); return; }
    setErr(false);
    setSt("calling");
    // noCall:true → record the lead but don't double-dial; /api/call does the hardened dial (DNC + caps).
    fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, source: "pulse-landing", consent, lang, noCall: true }) }).catch(() => {});
    try {
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }) });
    } catch { /* never block the user */ }
    setSt("done");
  };

  return (
    <section id="pulse" className="relative overflow-hidden px-5 py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(720px_380px_at_50%_0%,rgba(62,148,104,0.15),transparent),radial-gradient(680px_360px_at_82%_100%,rgba(214,194,154,0.12),transparent)]" />
      {/* MOVIMENTO: só FORMA e CARINHA. Sem contador — ver a nota do bloco GOLD lá em cima.
          `prefers-reduced-motion` congela tudo e devolve o painel legível e parado. */}
      <style>{`
        @keyframes pureveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pushine{to{background-position:220% center}}
        @keyframes pudot{0%,100%{opacity:.55}50%{opacity:1}}
        @keyframes gpArc{0%{stroke-dashoffset:157}18%{stroke-dashoffset:118}
                         42%{stroke-dashoffset:63}62%{stroke-dashoffset:16}
                         78%{stroke-dashoffset:55}100%{stroke-dashoffset:157}}
        @keyframes gpLo{0%,14%{opacity:1}26%,72%{opacity:0}92%,100%{opacity:1}}
        @keyframes gpMid{0%,16%{opacity:0}30%,44%{opacity:1}58%{opacity:0}
                         72%,84%{opacity:1}94%,100%{opacity:0}}
        @keyframes gpHi{0%,46%{opacity:0}58%,70%{opacity:1}80%,100%{opacity:0}}
        @keyframes gpBar{0%{transform:scaleX(.04)}50%{transform:scaleX(1)}100%{transform:scaleX(.04)}}
        .gp-sim .gp-arc{animation:gpArc 9s cubic-bezier(.45,0,.35,1) infinite}
        .gp-sim .gp-lo{animation:gpLo 9s linear infinite}
        .gp-sim .gp-mid{animation:gpMid 9s linear infinite}
        .gp-sim .gp-hi{animation:gpHi 9s linear infinite}
        .gp-sim .gp-bar{transform-origin:left center;animation:gpBar 9s cubic-bezier(.45,0,.35,1) infinite}
        @media (prefers-reduced-motion: reduce){
          *{animation-duration:.001ms !important}
          .gp-sim .gp-arc,.gp-sim .gp-lo,.gp-sim .gp-mid,.gp-sim .gp-hi,.gp-sim .gp-bar{animation:none !important}
          .gp-sim .gp-bar{transform:scaleX(1) !important;opacity:.4}
          .gp-sim .gp-lo,.gp-sim .gp-hi{opacity:0 !important}
          .gp-sim .gp-mid{opacity:1 !important}
        }
      `}</style>

      {/* ════════════════════════════════════════════════════════════════════════════════════
          O CARTÃO DO PRODUTO — o MESMO acabamento que o Luis aprovou no relatório
          (RelatorioEspelho.jsx → PulsePresente), com UMA diferença deliberada:
          🚨 BORDA SÓLIDA, não tracejada. Lá o tracejado significa PRESENTE/oferta; aqui o Pulse é
          um produto que se COMPRA, e um visual de brinde diria "de graça" mesmo sem a palavra.
          Pelo mesmo motivo não existe aqui nenhum "incluído/sem custo/on us" e o $49 aparece como
          PREÇO — nunca riscado. Riscar o preço da coisa que estamos vendendo é anunciar desconto
          que não existe. ═══════════════════════════════════════════════════════════════════════ */}
      <div className="gp-sim relative mx-auto max-w-4xl overflow-hidden rounded-xl3 border-2 p-6 backdrop-blur sm:p-9"
        style={{ borderColor: `rgba(${GOLD_RGB},0.55)`, background: `linear-gradient(135deg, rgba(${GOLD_RGB},0.10), transparent 68%)`, animation: "pureveal .8s ease both" }}>
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full blur-3xl" style={{ background: `rgba(${GOLD_RGB},0.16)` }} />

        {/* IDENTIDADE CENTRALIZADA (Luis, 2026-08-20: «esse deveria ir igual na landing»):
            logo → nome → categoria → preço, numa descida só. O nome do produto é o herói. */}
        <div className="flex flex-col items-center text-center">
          <img src={guileoMark} alt="Guileo" className="h-12 w-12 shrink-0 object-contain" />
          <h2 className="mt-2.5 text-[26px] font-black leading-none tracking-tight text-g-word sm:text-[32px]">Guileo Pulse</h2>
          <div className="mt-2 text-[11.5px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>{G.category}</div>
          {/* O PREÇO, como preço. Moeda e formato vêm do dicionário do idioma (PULSE_COPY[lang]),
              nunca de "$" cravado — pt mostra R$149/mês, en/es/hi mostram $49/mo. */}
          <div className="mt-3.5 flex items-end justify-center gap-1.5">
            {/* CHAMPANHE DE VERDADE (Luis, 2026-08-25: «dá aquela champanhe pro Pulse, dourado
                tava indo»). O gradiente passava por `g-light`, que é VERDE — no meio do degradê o
                número saía esverdeado e perdia o ouro. Agora o percurso é champanhe → creme →
                cobre: três tons da MESMA família, então o brilho corre sem trocar de cor. */}
            <span className="bg-gradient-to-r from-g-gold via-[#F0E4C8] to-g-copper bg-clip-text text-[40px] font-black leading-none tracking-tight tabular-nums text-transparent sm:text-[46px]"
              style={{ backgroundSize: "220% auto", animation: "pushine 6s linear infinite" }}>{G.price}</span>
            <span className="pb-1 text-[12.5px] font-bold text-g-ink">{G.per}</span>
          </div>
          {liveText && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-g-gold/40 bg-g-gold/[0.1] px-4 py-1.5 text-[12.5px] font-bold text-g-light">
              <span className="h-2 w-2 rounded-full bg-g-gold" style={{ animation: "pudot 1.6s ease-in-out infinite", boxShadow: "0 0 10px rgba(214,194,154,0.9)" }} />
              {liveText}
            </div>
          )}
        </div>

        {/* o argumento que vende: por que isto é melhor que mandar pesquisa */}
        <p className="mx-auto mt-6 max-w-2xl text-center text-[14px] font-semibold leading-relaxed text-g-word">{G.why}</p>

        {/* ── O PAINEL: termômetro · estrelas · a pesquisa ────────────────────────────────── */}
        <div className="mt-7">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-center">
            <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: GOLD }}>📈 {PN.tag}</span>
            {/* os DOIS selos: "painel de exemplo" (o que já existia) + ▶ simulação */}
            <span className="rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 text-[9.5px] font-bold normal-case tracking-normal text-g-muted">{PN.ex}</span>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{ borderColor: `rgba(${GOLD_RGB},0.5)`, color: GOLD, background: `rgba(${GOLD_RGB},0.08)` }}>▶ {G.sim}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">

            {/* 1. TERMÔMETRO — o arco enche e esvazia e a CARINHA acompanha a faixa.
                   A carinha É a leitura: nenhum número fixo ao lado de uma forma que muda. */}
            <div className="relative rounded-2xl border p-5 text-center backdrop-blur"
              style={{ borderColor: `rgba(${GOLD_RGB},0.28)`, background: `rgba(${GOLD_RGB},0.05)` }}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-g-muted">{PN.score}</div>
              <div className="relative mx-auto mt-2 w-full max-w-[190px]">
                <svg viewBox="0 0 120 68" className="w-full" role="img" aria-label={`${PN.score} — ${G.sim}`}>
                  <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="10" strokeLinecap="round" />
                  <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke={`rgba(${GOLD_RGB},0.30)`} strokeWidth="10" strokeLinecap="round" strokeDasharray="4 9" />
                  <path className="gp-arc" d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="url(#pulseGrad)" strokeWidth="10"
                    strokeLinecap="round" strokeDasharray="157" strokeDashoffset="157" />
                  <defs>
                    <linearGradient id="pulseGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#e0855f" /><stop offset="55%" stopColor="#FFC23D" /><stop offset="100%" stopColor="#3E9468" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* AS CARINHAS: três empilhadas, só uma visível em cada faixa do arco */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 grid h-9 place-items-center text-[26px] leading-none">
                  <span className="gp-lo col-start-1 row-start-1" style={{ opacity: 1 }}>😞</span>
                  <span className="gp-mid col-start-1 row-start-1" style={{ opacity: 0 }}>😐</span>
                  <span className="gp-hi col-start-1 row-start-1" style={{ opacity: 0 }}>😃</span>
                </div>
              </div>
            </div>

            {/* 2. DE ONDE A NOTA VEM — as 5 faixas enchendo e esvaziando em cascata, SEM percentual */}
            <div className="rounded-2xl border p-5 backdrop-blur" style={{ borderColor: `rgba(${GOLD_RGB},0.28)`, background: `rgba(${GOLD_RGB},0.05)` }}>
              <div className="text-center text-[11px] font-bold uppercase tracking-wider text-g-muted">{PN.stars}</div>
              <div className="mt-3 flex flex-col gap-1.5">
                {[5, 4, 3, 2, 1].map((n, i) => (
                  <div key={n} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-g-ink">{n}★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <span className="gp-bar block h-full w-full rounded-full"
                        style={{
                          background: n >= 4 ? "linear-gradient(90deg,#3E9468,rgba(62,148,104,0.35))"
                            : n === 3 ? "linear-gradient(90deg,#FFC23D,rgba(255,194,61,0.35))"
                              : "linear-gradient(90deg,#e0855f,rgba(224,133,95,0.35))",
                          animationDelay: `${i * 0.5}s`,
                          opacity: 0.9 - i * 0.1,
                        }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. A PESQUISA — o que o cliente do cliente vê */}
            <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5 backdrop-blur">
              <div className="text-center text-[11px] font-bold uppercase tracking-wider text-g-muted">{PN.ask}</div>
              <div className="mt-3 rounded-xl border border-white/10 bg-[#0e0d0b] p-4">
                <div className="text-[12.5px] font-semibold leading-snug text-g-word">{PN.q}</div>
                <div className="mt-3 flex justify-between text-[22px]" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ opacity: n <= 4 ? 0.35 : 1 }}>★</span>)}
                </div>
                <div className="mt-2 text-center text-[10.5px] text-g-muted">{PN.send}</div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[11.5px] leading-snug text-g-muted">▶ {G.simNote}</p>
        </div>

        {/* ═══ O DEGRAU (Luis, 2026-08-25) ═══════════════════════════════════════════════════
            O Pulse subiu para ANTES dos planos, e nessa posição ele tinha que encolher ou
            atropelaria o preço. Saíram daqui, e continuam vivos em /pulse:
              · a comparação com Birdeye · Podium · Qualtrics · Medallia
              · o bloco "os dois caminhos" (leitura passiva × pesquisa de 1 toque)
              · o formulário próprio de "me liga"
            Três máquinas de decisão empilhadas antes do quadro de planos não somam — dividem.
            🚨 O QUE ENTRA NO LUGAR é a única linha que impede a inversão de desqualificar o
            plano de $449: dizer que o $49 é CRÉDITO, não alternativa. Uma escada lida de baixo
            para cima funciona; dois produtos lado a lado, não. */}
        <div className="mt-7 rounded-xl3 border border-white/10 bg-white/[0.035] px-5 py-4 text-center backdrop-blur-sm"
>
          <p className="text-[14.5px] font-semibold leading-snug text-g-word">{G.degrau}</p>
        </div>

        {/* a porta para /pulse — página que não se alcança é página que não existe */}
        <div className="mt-5 text-center">
          <a href="/pulse" className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full border border-g-green/40 bg-g-green/[0.09] px-5 py-3 text-[13px] font-bold text-g-light transition hover:bg-g-green/[0.16]">
            {VER_MAIS[lang] || VER_MAIS.en}
          </a>
        </div>
      </div>
    </section>
  );
}
