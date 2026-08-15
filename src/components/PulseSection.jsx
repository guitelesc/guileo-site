import { useState, useEffect } from "react";
import { useLang } from "../i18n.jsx";
import ConsentText from "./ConsentText.jsx";

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
const PAINEL = {
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
const ESTRELAS = [{ n: 5, pct: 68 }, { n: 4, pct: 21 }, { n: 3, pct: 6 }, { n: 2, pct: 3 }, { n: 1, pct: 2 }];
const NOTA = 86;

const PISO_NEGOCIOS = 10;   // abaixo disso "N negócios" conta contra nós
const PISO_SINAIS = 500;    // idem para o volume de experiências medidas

// PulseSection — landing wedge for GUILEO PULSE, a standalone product:
// "the Qualtrics of the small business, run by AI". It MEASURES the satisfaction of the
// customer-of-the-customer from signals Gui already captures (call sentiment + reviews,
// passive) plus NPS/CSAT/CES (active), computes a CX score + drivers + detractors, and
// CLOSES THE LOOP on unhappy customers. Wedge = a FLAT $49/mo (R$149 in BR) vs the
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
    ctaLine: "See your Pulse score — Gui calls you now.",
    placeholder: "Your phone number",
    cta: "Call me",
    calling: "Calling…",
    done: "📞 Calling you now — pick up!",
    consent: "I agree to get one call from Gui (Guileo). Rates may apply; reply STOP to opt out.",
    consentErr: "Please check the box so Gui can call you.",
    foot: "No surveys to build · live in minutes · cancel anytime",
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
    us: "Pulse — R$149/mês, fixo",
    usSub: "todas as unidades incluídas",
    rivals: [
      { n: "Birdeye · Podium", p: "US$300–600 / unidade / mês" },
      { n: "Medallia · Qualtrics", p: "US$20K+ / ano" },
    ],
    price: "R$149",
    per: "/mês · fixo, todas as unidades",
    ctaLine: "Veja seu score Pulse — a Gui te liga agora.",
    placeholder: "Seu número de telefone",
    cta: "Me ligar",
    calling: "Ligando…",
    done: "📞 Ligando pra você agora — atende!",
    consent: "Concordo em receber uma ligação da Gui (Guileo). Podem incidir tarifas; responda STOP pra sair.",
    consentErr: "Marque a caixa pra Gui poder te ligar.",
    foot: "Sem pesquisa pra montar · no ar em minutos · cancele quando quiser",
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
    ctaLine: "Ve tu score Pulse — Gui te llama ahora.",
    placeholder: "Tu número de teléfono",
    cta: "Llamarme",
    calling: "Llamando…",
    done: "📞 Llamándote ahora — ¡contesta!",
    consent: "Acepto recibir una llamada de Gui (Guileo). Pueden aplicar tarifas; responde STOP para salir.",
    consentErr: "Marca la casilla para que Gui pueda llamarte.",
    foot: "Sin encuestas que armar · en marcha en minutos · cancela cuando quieras",
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
    ctaLine: "अपना Pulse स्कोर देखें — Gui अभी आपको कॉल करती है।",
    placeholder: "आपका फ़ोन नंबर",
    cta: "मुझे कॉल करें",
    calling: "कॉल हो रही है…",
    done: "📞 अभी आपको कॉल कर रहे हैं — उठाइए!",
    consent: "मैं Gui (Guileo) से एक कॉल पाने के लिए सहमत हूँ। शुल्क लागू हो सकते हैं; ऑप्ट-आउट के लिए STOP भेजें।",
    consentErr: "बॉक्स चेक करें ताकि Gui आपको कॉल कर सके।",
    foot: "कोई सर्वे नहीं बनाना · मिनटों में लाइव · कभी भी रद्द करें",
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
      <style>{`@keyframes pureveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}@keyframes pushine{to{background-position:220% center}}@keyframes puring{to{stroke-dashoffset:47}}@keyframes pudot{0%,100%{opacity:.55}50%{opacity:1}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(720px_380px_at_50%_0%,rgba(62,148,104,0.15),transparent),radial-gradient(680px_360px_at_82%_100%,rgba(214,194,154,0.12),transparent)]" />

      {/* header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-g-gold/40 bg-g-gold/10 px-4 py-1.5 text-[12px] font-black uppercase tracking-[0.24em] text-g-gold" style={{ animation: "pureveal .7s ease both" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-g-gold shadow-[0_0_8px_rgba(214,194,154,0.9)]" style={{ animation: "pudot 2.2s ease-in-out infinite" }} />
          {G.eyebrow}
        </div>
        <div className="mt-3 text-[12.5px] font-bold uppercase tracking-[0.18em] text-g-ink" style={{ animation: "pureveal .8s ease .06s both" }}>{G.category}</div>
        {liveText && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-g-green/40 bg-g-green/[0.1] px-4 py-1.5 text-[12.5px] font-bold text-g-light" style={{ animation: "pureveal .8s ease .14s both" }}>
            <span className="h-2 w-2 rounded-full bg-g-green" style={{ animation: "pudot 1.6s ease-in-out infinite", boxShadow: "0 0 10px rgba(62,148,104,0.9)" }} />
            {liveText}
          </div>
        )}
        {/* O título de 3 linhas e o parágrafo saíram: DEPOIS do preço, esta seção não abre nada —
            ela fecha. Quem chega aqui já leu a landing inteira e já viu $149–$999; não precisa de
            outro herói, precisa da razão de ser $49. Uma frase de contexto e o número bastam. */}
        <p className="mx-auto mt-3 max-w-lg text-[14.5px] leading-relaxed text-g-ink" style={{ animation: "pureveal .8s ease .2s both" }}>{G.sub}</p>
      </div>

      {/* Os 4 cartões de benefício saíram daqui (Luis: "tá confuso, é grande"). Eram 4 blocos de
          texto explicando COMO o Pulse funciona — explicação é trabalho de página de produto, não
          de um bloco que existe para capturar quem não comprou o plano. O texto continua vivo em
          `G.benefits` e é o conteúdo pronto para /pulse quando ela existir. */}

      {/* A faixa "40%" saiu: é um argumento de POR QUE medir experiência importa — convence quem
          ainda não quer o produto. Aqui embaixo, quem sobrou já foi convencido pela landing toda;
          o que falta é o preço bater. Mantida em `G.statBig/statText/statPunch` para /pulse. */}

      {/* ── PAINEL: termômetro · estrelas · pesquisa (ver a nota do topo) ─────────────────── */}
      <div className="mx-auto mt-10 max-w-4xl">
        <div className="mb-4 flex items-center justify-center gap-2 text-[11.5px] font-black uppercase tracking-[0.2em] text-g-gold">
          {PN.tag}
          <span className="rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 text-[9.5px] font-bold normal-case tracking-normal text-g-muted">{PN.ex}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">

          {/* 1. TERMÔMETRO — arco 0-100, a cor segue a nota (vermelho→âmbar→verde) */}
          <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.06] p-5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-g-muted">{PN.score}</div>
            <svg viewBox="0 0 120 68" className="mx-auto mt-2 w-full max-w-[190px]" role="img" aria-label={`${PN.score}: ${NOTA}`}>
              <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="10" strokeLinecap="round" />
              <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="url(#pulseGrad)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray="157" strokeDashoffset={157 - (157 * NOTA) / 100} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1)" }} />
              <defs>
                <linearGradient id="pulseGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#e0855f" /><stop offset="55%" stopColor="#FFC23D" /><stop offset="100%" stopColor="#3E9468" />
                </linearGradient>
              </defs>
            </svg>
            <div className="-mt-4 text-[34px] font-black leading-none tabular-nums text-g-word">{NOTA}</div>
          </div>

          {/* 2. DE ONDE A NOTA VEM — 1 a 5 estrelas */}
          <div className="rounded-2xl border border-g-gold/25 bg-g-gold/[0.05] p-5">
            <div className="text-center text-[11px] font-bold uppercase tracking-wider text-g-muted">{PN.stars}</div>
            <div className="mt-3 flex flex-col gap-1.5">
              {ESTRELAS.map((e) => (
                <div key={e.n} className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-g-ink">{e.n}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <span className="block h-full rounded-full" style={{ width: `${e.pct}%`, background: e.n >= 4 ? "#3E9468" : e.n === 3 ? "#FFC23D" : "#e0855f" }} />
                  </span>
                  <span className="w-8 shrink-0 text-[11px] tabular-nums text-g-muted">{e.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. A PESQUISA — o que o cliente do cliente vê */}
          <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
            <div className="text-center text-[11px] font-bold uppercase tracking-wider text-g-muted">{PN.ask}</div>
            <div className="mt-3 rounded-xl border border-white/10 bg-[#0e0d0b] p-4">
              <div className="text-[12.5px] font-semibold leading-snug text-g-word">{PN.q}</div>
              <div className="mt-3 flex justify-between text-[22px]">
                {[1,2,3,4,5].map((n) => <span key={n} style={{ opacity: n <= 4 ? 0.35 : 1 }}>★</span>)}
              </div>
              <div className="mt-2 text-center text-[10.5px] text-g-muted">{PN.send}</div>
            </div>
          </div>

        </div>
        <div className="mt-5 text-center">
          <a href="/pulse" className="inline-flex items-center gap-1.5 rounded-full border border-g-green/40 bg-g-green/[0.09] px-5 py-2.5 text-[13px] font-bold text-g-light transition hover:bg-g-green/[0.16]">
            {VER_MAIS[lang] || VER_MAIS.en}
          </a>
        </div>
      </div>

      {/* comparison */}
      <div className="mx-auto mt-10 max-w-3xl text-center">
        <div className="text-[12px] font-black uppercase tracking-[0.2em] text-g-gold" style={{ animation: "pureveal .7s ease both" }}>{G.compare}</div>
        <div className="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          {/* us */}
          <div className="relative overflow-hidden rounded-2xl border border-g-green/50 bg-g-green/[0.12] px-6 py-4 shadow-gold" style={{ animation: "pureveal .7s ease .1s both" }}>
            <span className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-g-green/20 blur-2xl" />
            <div className="text-[17px] font-black text-g-word">✅ {G.us}</div>
            <div className="mt-0.5 text-[12px] font-semibold text-g-light">{G.usSub}</div>
          </div>
          <span className="hidden text-lg font-black text-g-gold/60 sm:inline">vs</span>
          {/* rivals */}
          {G.rivals.map((r, i) => (
            <div key={r.n} className="rounded-2xl border border-g-line bg-white/[0.03] px-6 py-4 opacity-80" style={{ animation: `pureveal .7s ease ${0.2 + i * 0.08}s both` }}>
              <div className="text-[14.5px] font-bold text-g-ink line-through decoration-g-copper/50">{r.n}</div>
              <div className="mt-0.5 text-[12.5px] font-semibold text-g-muted">{r.p}</div>
            </div>
          ))}
        </div>
      </div>

      {/* price + CTA (AI calls you) */}
      <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-xl3 border border-g-gold/35 bg-white/[0.04] p-7 shadow-lift backdrop-blur-xl sm:p-9" style={{ animation: "pureveal .8s ease .3s both" }}>
        <div className="pointer-events-none absolute -z-10 h-40 w-40 rounded-full bg-g-gold/10 blur-3xl" />
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="text-center sm:text-left">
            <div className="flex items-end justify-center gap-1.5 sm:justify-start">
              <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-[46px] font-black leading-none tracking-tight text-transparent tabular-nums" style={{ backgroundSize: "220% auto", animation: "pushine 6s linear infinite" }}>{G.price}</span>
              <span className="pb-1 text-[13px] font-bold text-g-ink">{G.per}</span>
            </div>
            <p className="mt-3 text-[14.5px] font-semibold text-g-word">{G.ctaLine}</p>
          </div>
        </div>

        {st === "done" ? (
          <div className="mt-6 rounded-2xl border border-g-green/40 bg-g-green/15 px-5 py-4 text-center text-[15px] font-bold text-g-light">{G.done}</div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={G.placeholder} aria-label={G.placeholder}
                className="flex-1 rounded-full border border-white/20 bg-black/20 px-5 py-3.5 text-[15px] text-g-word placeholder:text-g-muted outline-none transition focus:border-g-green/70" />
              <button type="submit" disabled={st === "calling"} aria-label={G.cta}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-7 py-3.5 text-[15px] font-extrabold text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%)" }}>
                <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" />
                <span className="relative">📞 {st === "calling" ? G.calling : G.cta}</span>
              </button>
            </div>
            <label className={`flex items-start gap-2 text-[11px] leading-snug ${err && !consent ? "text-g-gold" : "text-g-muted"}`}>
              <input type="checkbox" required checked={consent} onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setErr(false); }} className="mt-0.5 h-4 w-4 shrink-0 accent-g-green" />
              <span><ConsentText lang={lang} /></span>
            </label>
            {err && (!phone.trim() || !consent) && <p role="alert" className="text-center text-[12px] font-semibold text-g-gold">{G.consentErr}</p>}
          </form>
        )}
        <p className="mt-4 text-center text-[11.5px] font-semibold text-g-muted">{G.foot}</p>
      </div>
    </section>
  );
}
