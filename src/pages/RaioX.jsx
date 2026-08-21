import { useState } from "react";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { waLink } from "../data/contact";
import logo from "../assets/guileo-mark.png";

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// /raio-x — O PEDIDO PÚBLICO DO GUILEO X-RAY (o motor de aquisição)
//
// Qualquer dono de negócio pede o raio-X do próprio negócio, de graça, em troca de responder um
// quiz curto e marcar 15 minutos. O relatório que sai é o MESMO documento que o Luis mandava à
// mão (/apresentacao/:id) — medido, com evidência por número.
//
// TRÊS REGRAS QUE ESTA TELA OBEDECE:
//  1. "Não sei" é resposta válida e aparece em todas as perguntas de número. O relatório mostra
//     não-medido; forçar um chute aqui viraria número inventado lá dentro — o pecado que a
//     página inteira existe para não cometer.
//  2. O que o dono responde é DECLARADO, não medido. A tela diz isso antes de perguntar.
//  3. A call de 15 minutos usa a agenda REAL (motor biz_*). Se a agenda não responder, a tela
//     admite e oferece WhatsApp — nunca desenha horário que não existe.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const D = {
  badge: { en: "Free · Guileo X-Ray", pt: "Grátis · Guileo X-Ray", es: "Gratis · Guileo X-Ray", hi: "मुफ़्त · Guileo X-Ray" },
  h1a: { en: "A measured X-Ray of your business — ", pt: "Um raio-X medido do seu negócio — ", es: "Una radiografía medida de tu negocio — ", hi: "आपके व्यवसाय का मापा हुआ X-Ray — " },
  h1b: { en: "free, in 2 minutes.", pt: "grátis, em 2 minutos.", es: "gratis, en 2 minutos.", hi: "मुफ़्त, 2 मिनट में।" },
  intro: {
    en: "We read your site, your channels, your phone path and your catalog, and send you a report with a score per area — every number with the evidence next to it. What we can't measure appears as “not measured”, never as zero.",
    pt: "A gente lê o seu site, seus canais, o caminho do seu telefone e seu catálogo, e te manda um relatório com nota por área — cada número com a evidência do lado. O que não dá pra medir aparece como “não medido”, nunca como zero.",
    es: "Leemos tu sitio, tus canales, el camino de tu teléfono y tu catálogo, y te enviamos un informe con nota por área — cada número con su evidencia al lado. Lo que no se puede medir aparece como “no medido”, nunca como cero.",
    hi: "हम आपकी वेबसाइट, चैनल, फ़ोन का रास्ता और कैटलॉग पढ़ते हैं और हर क्षेत्र के स्कोर वाली रिपोर्ट भेजते हैं — हर आंकड़े के साथ उसका प्रमाण। जो नहीं माप सकते वह “नहीं मापा गया” दिखता है, कभी शून्य नहीं।",
  },
  langAviso: {
    en: "", pt: "", es: "",
    hi: "⚠️ यह पेज हिंदी में है, पर रिपोर्ट अंग्रेज़ी में बनती है — हमारा मापन इंजन अभी 3 भाषाएँ बोलता है (pt · en · es)।",
  },
  start: { en: "Get my free X-Ray →", pt: "Quero meu raio-X grátis →", es: "Quiero mi radiografía gratis →", hi: "मेरा मुफ़्त X-Ray पाएँ →" },
  noLogin: { en: "No login. No card. The report is yours to keep.", pt: "Sem cadastro. Sem cartão. O relatório é seu.", es: "Sin registro. Sin tarjeta. El informe es tuyo.", hi: "कोई लॉगिन नहीं। कोई कार्ड नहीं। रिपोर्ट आपकी है।" },

  step: { en: "Step", pt: "Passo", es: "Paso", hi: "चरण" },
  of: { en: "of", pt: "de", es: "de", hi: "/" },
  next: { en: "Continue →", pt: "Continuar →", es: "Continuar →", hi: "आगे →" },
  back: { en: "← Back", pt: "← Voltar", es: "← Atrás", hi: "← पीछे" },
  dontKnow: { en: "I don't know", pt: "Não sei dizer", es: "No sé", hi: "मुझे नहीं पता" },
  declaredNote: {
    en: "Your answers are recorded as DECLARED BY YOU — the report says so next to every number that uses them. Only what we measure ourselves counts toward the score.",
    pt: "Suas respostas entram como DECLARADAS POR VOCÊ — o relatório diz isso do lado de todo número que as usa. Só o que a gente mede entra na nota.",
    es: "Tus respuestas entran como DECLARADAS POR TI — el informe lo dice junto a cada número que las usa. Solo lo que medimos cuenta para la nota.",
    hi: "आपके उत्तर “आपके द्वारा घोषित” के रूप में दर्ज होते हैं — रिपोर्ट हर ऐसे आंकड़े के पास यह लिखती है। स्कोर में केवल वही गिना जाता है जो हम स्वयं मापते हैं।",
  },

  qSite: { en: "What's your website?", pt: "Qual é o site do seu negócio?", es: "¿Cuál es el sitio de tu negocio?", hi: "आपकी वेबसाइट क्या है?" },
  phSite: { en: "yourbusiness.com", pt: "seunegocio.com.br", es: "tunegocio.com", hi: "yourbusiness.com" },
  qBiz: { en: "Business name (optional)", pt: "Nome do negócio (opcional)", es: "Nombre del negocio (opcional)", hi: "व्यवसाय का नाम (वैकल्पिक)" },

  qHoras: { en: "When is your business open?", pt: "Qual o horário do seu negócio?", es: "¿Cuál es el horario de tu negocio?", hi: "आपका व्यवसाय कब खुला रहता है?" },
  horas: {
    en: [["Open 24 hours", 168], ["Business hours, Mon–Fri (~9h/day)", 45], ["Six days, extended (~11h/day)", 66], ["Every day, extended (~11h/day)", 77]],
    pt: [["Aberto 24 horas", 168], ["Horário comercial, seg–sex (~9h/dia)", 45], ["Seis dias, estendido (~11h/dia)", 66], ["Todo dia, estendido (~11h/dia)", 77]],
    es: [["Abierto 24 horas", 168], ["Horario comercial, lun–vie (~9h/día)", 45], ["Seis días, extendido (~11h/día)", 66], ["Todos los días, extendido (~11h/día)", 77]],
    hi: [["24 घंटे खुला", 168], ["सोम–शुक्र, कार्यसमय (~9घं/दिन)", 45], ["छह दिन, विस्तारित (~11घं/दिन)", 66], ["हर दिन, विस्तारित (~11घं/दिन)", 77]],
  },
  qQuem: { en: "Who answers the phone today?", pt: "Quem atende o telefone hoje?", es: "¿Quién atiende el teléfono hoy?", hi: "आज फ़ोन कौन उठाता है?" },
  quem: {
    en: [["I do", "eu"], ["My team / front desk", "equipe"], ["Voicemail takes it", "caixa postal"], ["Often nobody", "ninguem"]],
    pt: [["Eu mesmo", "eu"], ["Minha equipe / recepção", "equipe"], ["Cai na caixa postal", "caixa postal"], ["Muitas vezes ninguém", "ninguem"]],
    es: [["Yo mismo", "eu"], ["Mi equipo / recepción", "equipe"], ["Cae al buzón", "caixa postal"], ["Muchas veces nadie", "ninguem"]],
    hi: [["मैं ख़ुद", "eu"], ["मेरी टीम / रिसेप्शन", "equipe"], ["वॉइसमेल पर जाता है", "caixa postal"], ["अक्सर कोई नहीं", "ninguem"]],
  },
  qLig: { en: "Roughly how many calls a week do you get?", pt: "Quantas ligações por semana você recebe, mais ou menos?", es: "¿Cuántas llamadas por semana recibes, más o menos?", hi: "हफ़्ते में लगभग कितनी कॉल आती हैं?" },
  phLig: { en: "e.g. 40", pt: "ex.: 40", es: "ej.: 40", hi: "जैसे 40" },
  qTicket: { en: "What does an average customer spend per visit?", pt: "Quanto um cliente gasta em média por atendimento?", es: "¿Cuánto gasta un cliente en promedio por visita?", hi: "एक ग्राहक औसतन प्रति विज़िट कितना ख़र्च करता है?" },
  phTicket: { en: "e.g. 120", pt: "ex.: 120", es: "ej.: 120", hi: "जैसे 120" },
  ticketNota: { en: "In your local currency — it goes into the report as declared.", pt: "Na sua moeda — entra no relatório como declarado.", es: "En tu moneda — entra en el informe como declarado.", hi: "आपकी मुद्रा में — रिपोर्ट में घोषित के रूप में जाता है।" },
  qDor: { en: "What hurts the most right now?", pt: "O que mais dói hoje?", es: "¿Qué duele más hoy?", hi: "अभी सबसे ज़्यादा तकलीफ़ क्या दे रहा है?" },
  dores: {
    en: ["Calls I never answer", "No-shows and cancellations", "Few new customers", "I answer everything myself", "Slow to reply to leads", "Something else"],
    pt: ["Ligação que eu não atendo", "Falta e cancelamento", "Poucos clientes novos", "Eu atendo tudo sozinho", "Demoro pra responder lead", "Outra coisa"],
    es: ["Llamadas que no contesto", "Ausencias y cancelaciones", "Pocos clientes nuevos", "Atiendo todo yo solo", "Tardo en responder leads", "Otra cosa"],
    hi: ["कॉल जो मैं नहीं उठा पाता", "नो-शो और रद्दीकरण", "कम नए ग्राहक", "सब कुछ मैं अकेले संभालता हूँ", "लीड्स को जवाब देने में देरी", "कुछ और"],
  },

  qContato: { en: "Where do we send your X-Ray?", pt: "Pra onde mandamos seu raio-X?", es: "¿A dónde enviamos tu radiografía?", hi: "आपका X-Ray कहाँ भेजें?" },
  phNome: { en: "Your name", pt: "Seu nome", es: "Tu nombre", hi: "आपका नाम" },
  phContato: { en: "Email or phone", pt: "Email ou telefone", es: "Correo o teléfono", hi: "ईमेल या फ़ोन" },
  consent: {
    en: "You can call or text me about my report.", pt: "Podem me ligar ou mandar mensagem sobre o meu relatório.",
    es: "Pueden llamarme o escribirme sobre mi informe.", hi: "आप मेरी रिपोर्ट के बारे में मुझे कॉल या संदेश कर सकते हैं।",
  },
  gerar: { en: "Run my X-Ray →", pt: "Rodar meu raio-X →", es: "Ejecutar mi radiografía →", hi: "मेरा X-Ray चलाएँ →" },
  gerando: { en: "Measuring your business…", pt: "Medindo seu negócio…", es: "Midiendo tu negocio…", hi: "आपका व्यवसाय मापा जा रहा है…" },
  errCampos: { en: "Fill in your site and a contact.", pt: "Preencha o site e um contato.", es: "Completa el sitio y un contacto.", hi: "अपनी वेबसाइट और संपर्क भरें।" },
  errSite: { en: "We couldn't read that address. Check it and try again.", pt: "Não consegui ler esse endereço. Confira e tente de novo.", es: "No pude leer esa dirección. Revísala e inténtalo otra vez.", hi: "यह पता पढ़ा नहीं जा सका। जाँचें और फिर कोशिश करें।" },
  errNaoLeu: { en: "That site didn't open for reading (it may block robots). Nothing was invented — try another address or talk to us.", pt: "Esse site não abriu para leitura (pode estar bloqueando robô). Nada foi inventado — tente outro endereço ou fale com a gente.", es: "Ese sitio no abrió para lectura (puede bloquear robots). Nada fue inventado — prueba otra dirección o habla con nosotros.", hi: "वह साइट पढ़ने के लिए नहीं खुली (शायद रोबोट ब्लॉक करती है)। कुछ भी मनगढ़ंत नहीं है — दूसरा पता आज़माएँ या हमसे बात करें।" },
  errRate: { en: "Too many requests from here. Try again later.", pt: "Muitos pedidos daqui. Tente de novo mais tarde.", es: "Demasiadas solicitudes desde aquí. Inténtalo más tarde.", hi: "यहाँ से बहुत सारे अनुरोध। बाद में कोशिश करें।" },
  errGeral: { en: "Something failed on our side. Nothing was made up — try again.", pt: "Algo falhou do nosso lado. Nada foi inventado — tente de novo.", es: "Algo falló de nuestro lado. Nada fue inventado — inténtalo otra vez.", hi: "हमारी ओर से कुछ विफल रहा। कुछ भी मनगढ़ंत नहीं — फिर कोशिश करें।" },

  pronto: { en: "Your X-Ray is ready", pt: "Seu raio-X está pronto", es: "Tu radiografía está lista", hi: "आपका X-Ray तैयार है" },
  abrir: { en: "Open my X-Ray →", pt: "Abrir meu raio-X →", es: "Abrir mi radiografía →", hi: "मेरा X-Ray खोलें →" },
  scoreLbl: { en: "Overall score", pt: "Nota geral", es: "Nota general", hi: "कुल स्कोर" },
  reaproveitado: {
    en: "This domain was measured in the last 7 days, so we're showing you that report instead of scanning the site again.",
    pt: "Este domínio foi medido nos últimos 7 dias, então mostramos aquele relatório em vez de varrer o site de novo.",
    es: "Este dominio se midió en los últimos 7 días, así que te mostramos ese informe en vez de escanear el sitio otra vez.",
    hi: "यह डोमेन पिछले 7 दिनों में मापा गया था, इसलिए हम साइट दोबारा स्कैन करने के बजाय वही रिपोर्ट दिखा रहे हैं।",
  },
  callTit: { en: "Now the 15 minutes", pt: "Agora os 15 minutos", es: "Ahora los 15 minutos", hi: "अब 15 मिनट" },
  callSub: {
    en: "Pick a slot and we walk through your report together — what's leaking, what to fix first, and what it costs.",
    pt: "Escolha um horário e a gente passa pelo seu relatório junto — o que está vazando, o que consertar primeiro e quanto custa.",
    es: "Elige un horario y repasamos tu informe juntos — qué se está fugando, qué arreglar primero y cuánto cuesta.",
    hi: "एक समय चुनें और हम आपकी रिपोर्ट साथ में देखेंगे — कहाँ रिसाव है, पहले क्या ठीक करें, और लागत क्या है।",
  },
  verHorarios: { en: "See available times", pt: "Ver horários disponíveis", es: "Ver horarios disponibles", hi: "उपलब्ध समय देखें" },
  buscando: { en: "Checking the real calendar…", pt: "Consultando a agenda real…", es: "Consultando la agenda real…", hi: "असली कैलेंडर देखा जा रहा है…" },
  semAgenda: {
    en: "The calendar isn't answering right now, so we won't show times we can't honor. Message us and we'll book it by hand.",
    pt: "A agenda não está respondendo agora, e a gente não mostra horário que não pode cumprir. Chama no WhatsApp que marcamos na mão.",
    es: "La agenda no responde ahora, y no mostramos horarios que no podamos cumplir. Escríbenos y lo agendamos a mano.",
    hi: "कैलेंडर अभी जवाब नहीं दे रहा, और हम ऐसा समय नहीं दिखाते जिसे निभा न सकें। हमें संदेश करें, हम हाथ से बुक कर देंगे।",
  },
  semVaga: { en: "No open slots right now.", pt: "Nenhuma vaga aberta agora.", es: "No hay huecos abiertos ahora.", hi: "अभी कोई खुला स्लॉट नहीं है।" },
  marcando: { en: "Booking…", pt: "Marcando…", es: "Reservando…", hi: "बुक हो रहा है…" },
  marcado: { en: "Booked ✓", pt: "Marcado ✓", es: "Reservado ✓", hi: "बुक हो गया ✓" },
  marcadoSub: { en: "You'll get the confirmation at the contact you gave us.", pt: "A confirmação chega no contato que você deu.", es: "La confirmación llega al contacto que nos diste.", hi: "पुष्टि उसी संपर्क पर आएगी जो आपने दिया।" },
  naoMarcou: { en: "That slot didn't take. Pick another one.", pt: "Esse horário não pegou. Escolha outro.", es: "Ese horario no funcionó. Elige otro.", hi: "वह स्लॉट नहीं लगा। दूसरा चुनें।" },
  wa: { en: "Talk on WhatsApp", pt: "Falar no WhatsApp", es: "Hablar por WhatsApp", hi: "WhatsApp पर बात करें" },
};

const TOTAL = 6; // site · horário · quem atende · ligações · ticket · dor  (contato é a tela final)

export default function RaioX() {
  const { lang } = useLang();
  const L = (o) => (o && (o[lang] ?? o.en)) ?? "";
  useSeo({
    title: lang === "pt" ? "Guileo X-Ray — raio-X grátis do seu negócio (medido, com evidência)"
      : lang === "es" ? "Guileo X-Ray — radiografía gratis de tu negocio (medida, con evidencia)"
      : lang === "hi" ? "Guileo X-Ray — आपके व्यवसाय का मुफ़्त X-Ray (मापा हुआ, प्रमाण के साथ)"
      : "Guileo X-Ray — a free, measured X-Ray of your business",
    description: L(D.intro),
    path: "/raio-x",
  });

  const [step, setStep] = useState(-1); // -1 intro · 0..5 perguntas · 6 contato · 7 resultado
  const [site, setSite] = useState("");
  const [negocio, setNegocio] = useState("");
  const [horas, setHoras] = useState(undefined);   // number | null (não sei) | undefined (sem resposta)
  const [quem, setQuem] = useState(null);
  const [ligacoes, setLigacoes] = useState("");
  const [ticket, setTicket] = useState("");
  const [dor, setDor] = useState("");
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [consent, setConsent] = useState(true);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState(null);

  // agenda
  const [slots, setSlots] = useState(null);      // null = não pedido · [] = pedido e vazio
  const [agErro, setAgErro] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [marcando, setMarcando] = useState("");
  const [marcado, setMarcado] = useState(null);

  const post = async (body) => {
    const r = await fetch("/api/raio-x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json().catch(() => ({ ok: false, erro: "falha" }));
  };

  async function gerar() {
    if (!site.trim() || !contato.trim()) { setErro(L(D.errCampos)); return; }
    setErro(""); setCarregando(true);
    const j = await post({
      acao: "gerar", site, nome, negocio, contato, lang, consent,
      quiz: {
        horas_abertas_semana: horas ?? null,
        ligacoes_semana: ligacoes || null,
        ticket_medio: ticket || null,
        quem_atende: quem,
        dor,
      },
    });
    setCarregando(false);
    if (j.ok) { setRes(j); setStep(7); return; }
    setErro(j.erro === "site_invalido" ? L(D.errSite)
      : j.erro === "nao_deu_pra_ler" ? L(D.errNaoLeu)
      : (j.erro === "rate" || j.erro === "rate_dominio") ? L(D.errRate)
      : L(D.errGeral));
  }

  async function verHorarios() {
    setBuscando(true); setAgErro("");
    const j = await post({ acao: "horarios", lang });
    setBuscando(false);
    if (j.ok) setSlots(j.slots || []);
    else { setSlots([]); setAgErro(j.agenda_indisponivel || "indisponivel"); }
  }

  async function marcar(quando) {
    setMarcando(quando); setAgErro("");
    const j = await post({ acao: "marcar", quando, nome, contato, lang });
    setMarcando("");
    if (j.ok) setMarcado(j);
    else setAgErro(j.agenda_indisponivel || L(D.naoMarcou));
  }

  const quandoLegivel = (iso) => {
    try {
      const loc = { pt: "pt-BR", es: "es-ES", hi: "hi-IN", en: "en-US" }[lang] || "en-US";
      return new Date(iso).toLocaleString(loc, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  const Btn = ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled} className="w-full rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110 disabled:opacity-50">{children}</button>
  );
  const Opcao = ({ children, onClick, on }) => (
    <button onClick={onClick} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left text-[15px] font-semibold transition hover:-translate-y-0.5 motion-reduce:transform-none ${on ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-g-line bg-white/[0.03] text-g-ink hover:bg-white/[0.06]"}`}>
      <span className="min-w-0 break-words">{children}</span><span className="ml-2 shrink-0 text-g-green">→</span>
    </button>
  );
  const Cabecalho = ({ n, titulo }) => (
    <>
      <div className="text-[12px] font-bold text-g-muted">{L(D.step)} {n} {L(D.of)} {TOTAL}</div>
      <h2 className="mt-2 text-[23px] font-bold leading-snug text-g-word">{titulo}</h2>
    </>
  );
  const Voltar = ({ para }) => (
    <button onClick={() => setStep(para)} className="mt-5 text-[13px] font-semibold text-g-muted hover:text-g-ink">{L(D.back)}</button>
  );

  const progresso = step < 0 ? 0 : step >= 7 ? 100 : Math.round((step / 7) * 100);

  return (
    <div className="min-h-screen text-g-word">
      <div className="flex items-center justify-between px-5 py-4">
        <a href="/" className="flex items-center gap-2"><img src={logo} alt="" className="h-7 w-7 object-contain" /><span className="font-black">Guileo</span></a>
        <span className="text-[11px] font-bold uppercase tracking-wider text-g-muted">{L(D.badge)}</span>
      </div>
      <div className="h-1 w-full bg-white/5"><div className="h-full bg-gradient-to-r from-g-green to-g-gold transition-all duration-500" style={{ width: `${progresso}%` }} /></div>

      <main className="mx-auto flex min-h-[80vh] w-full max-w-xl flex-col justify-center px-5 py-12">
        {step === -1 && (
          <div className="text-center">
            <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{L(D.badge)}</div>
            <h1 className="mt-4 font-black leading-[1.03] tracking-tight" style={{ fontSize: "clamp(2rem,5.6vw,3.1rem)" }}>
              <span className="text-g-word">{L(D.h1a)}</span>
              <span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{L(D.h1b)}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-g-ink">{L(D.intro)}</p>
            {L(D.langAviso) && <p className="mx-auto mt-3 max-w-md text-[12.5px] font-semibold text-g-gold">{L(D.langAviso)}</p>}
            <div className="mx-auto mt-8 max-w-md"><Btn onClick={() => setStep(0)}>{L(D.start)}</Btn></div>
            <div className="mt-4 text-[12px] text-g-muted">{L(D.noLogin)}</div>
          </div>
        )}

        {step === 0 && (
          <div>
            <Cabecalho n={1} titulo={L(D.qSite)} />
            <input value={site} onChange={(e) => setSite(e.target.value)} placeholder={L(D.phSite)} aria-label={L(D.qSite)} inputMode="url"
              className="mt-5 w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <input value={negocio} onChange={(e) => setNegocio(e.target.value)} placeholder={L(D.qBiz)} aria-label={L(D.qBiz)}
              className="mt-3 w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <div className="mt-5"><Btn onClick={() => site.trim() ? setStep(1) : setErro(L(D.errCampos))} disabled={!site.trim()}>{L(D.next)}</Btn></div>
            {erro && <p role="alert" className="mt-3 text-center text-[13px] font-semibold text-g-gold">{erro}</p>}
            <p className="mt-6 rounded-xl border border-g-line bg-white/[0.03] p-4 text-[12.5px] leading-relaxed text-g-muted">{L(D.declaredNote)}</p>
          </div>
        )}

        {step === 1 && (
          <div>
            <Cabecalho n={2} titulo={L(D.qHoras)} />
            <div className="mt-5 space-y-2.5">
              {(D.horas[lang] || D.horas.en).map(([rot, h]) => (
                <Opcao key={rot} on={horas === h} onClick={() => { setHoras(h); setStep(2); }}>{rot}</Opcao>
              ))}
              <Opcao on={horas === null} onClick={() => { setHoras(null); setStep(2); }}>{L(D.dontKnow)}</Opcao>
            </div>
            <Voltar para={0} />
          </div>
        )}

        {step === 2 && (
          <div>
            <Cabecalho n={3} titulo={L(D.qQuem)} />
            <div className="mt-5 space-y-2.5">
              {(D.quem[lang] || D.quem.en).map(([rot, v]) => (
                <Opcao key={v} on={quem === v} onClick={() => { setQuem(v); setStep(3); }}>{rot}</Opcao>
              ))}
            </div>
            <Voltar para={1} />
          </div>
        )}

        {step === 3 && (
          <div>
            <Cabecalho n={4} titulo={L(D.qLig)} />
            <input value={ligacoes} onChange={(e) => setLigacoes(e.target.value.replace(/[^0-9]/g, ""))} placeholder={L(D.phLig)} aria-label={L(D.qLig)} inputMode="numeric"
              className="mt-5 w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <div className="mt-4"><Btn onClick={() => setStep(4)}>{L(D.next)}</Btn></div>
            <button onClick={() => { setLigacoes(""); setStep(4); }} className="mt-3 w-full rounded-xl border border-g-line bg-white/[0.03] px-4 py-3 text-[14px] font-semibold text-g-muted hover:text-g-ink">{L(D.dontKnow)}</button>
            <Voltar para={2} />
          </div>
        )}

        {step === 4 && (
          <div>
            <Cabecalho n={5} titulo={L(D.qTicket)} />
            <input value={ticket} onChange={(e) => setTicket(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={L(D.phTicket)} aria-label={L(D.qTicket)} inputMode="decimal"
              className="mt-5 w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <p className="mt-2 text-[12px] text-g-muted">{L(D.ticketNota)}</p>
            <div className="mt-4"><Btn onClick={() => setStep(5)}>{L(D.next)}</Btn></div>
            <button onClick={() => { setTicket(""); setStep(5); }} className="mt-3 w-full rounded-xl border border-g-line bg-white/[0.03] px-4 py-3 text-[14px] font-semibold text-g-muted hover:text-g-ink">{L(D.dontKnow)}</button>
            <Voltar para={3} />
          </div>
        )}

        {step === 5 && (
          <div>
            <Cabecalho n={6} titulo={L(D.qDor)} />
            <div className="mt-5 space-y-2.5">
              {(D.dores[lang] || D.dores.en).map((rot) => (
                <Opcao key={rot} on={dor === rot} onClick={() => { setDor(rot); setStep(6); }}>{rot}</Opcao>
              ))}
            </div>
            <Voltar para={4} />
          </div>
        )}

        {step === 6 && (
          <div>
            <h2 className="text-[23px] font-bold leading-snug text-g-word">{L(D.qContato)}</h2>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={L(D.phNome)} aria-label={L(D.phNome)}
              className="mt-5 w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <input value={contato} onChange={(e) => setContato(e.target.value)} placeholder={L(D.phContato)} aria-label={L(D.phContato)}
              className="mt-3 w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <label className="mt-4 flex items-start gap-2.5 text-[13px] text-g-ink">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#3E9468]" />
              <span>{L(D.consent)}</span>
            </label>
            <div className="mt-5"><Btn onClick={gerar} disabled={carregando}>{carregando ? L(D.gerando) : L(D.gerar)}</Btn></div>
            {erro && <p role="alert" className="mt-3 text-center text-[13px] font-semibold text-g-gold">{erro}</p>}
            <Voltar para={5} />
          </div>
        )}

        {step === 7 && res && (
          <div>
            <div className="rounded-2xl border border-g-green/30 bg-g-green/[0.07] p-6 text-center">
              <div className="text-3xl">🩻</div>
              <div className="mt-2 text-[20px] font-black text-g-word">{L(D.pronto)}{nome ? `, ${nome.split(" ")[0]}` : ""}!</div>
              {res.score != null && (
                <div className="mt-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-g-muted">{L(D.scoreLbl)}</div>
                  <div className="text-[46px] font-black leading-none"><span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{res.score}<span className="text-[22px]">/100</span></span></div>
                </div>
              )}
              <a href={res.link} className="mt-5 inline-block rounded-xl bg-gradient-to-r from-g-green to-g-dark px-6 py-3.5 text-[15px] font-bold text-white transition hover:brightness-110">{L(D.abrir)}</a>
              {res.reaproveitado && <p className="mt-4 text-[12px] leading-relaxed text-g-muted">{L(D.reaproveitado)}</p>}
            </div>

            <div className="mt-6 rounded-2xl border border-g-line bg-white/[0.03] p-6">
              <div className="text-[17px] font-bold text-g-word">{L(D.callTit)}</div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-g-ink">{L(D.callSub)}</p>

              {marcado ? (
                <div className="mt-4 rounded-xl border border-g-green/30 bg-g-green/[0.08] p-4">
                  <div className="text-[15px] font-bold text-g-word">{L(D.marcado)}{marcado.ref ? ` · ${marcado.ref}` : ""}</div>
                  <div className="mt-1 text-[12.5px] text-g-muted">{L(D.marcadoSub)}</div>
                </div>
              ) : slots === null ? (
                <button onClick={verHorarios} disabled={buscando} className="mt-4 w-full rounded-xl border border-g-green/40 bg-g-green/[0.08] px-5 py-3 text-[14.5px] font-bold text-g-word transition hover:bg-g-green/[0.14] disabled:opacity-50">
                  {buscando ? L(D.buscando) : L(D.verHorarios)}
                </button>
              ) : slots.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {slots.slice(0, 6).map((sl) => (
                    <button key={sl.start} onClick={() => marcar(sl.start)} disabled={!!marcando}
                      className="rounded-xl border border-g-line bg-white/[0.04] px-3 py-3 text-[13.5px] font-semibold text-g-ink transition hover:border-g-green/40 hover:bg-white/[0.07] disabled:opacity-50">
                      {marcando === sl.start ? L(D.marcando) : quandoLegivel(sl.start)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-g-gold/30 bg-g-gold/[0.06] p-4 text-[13px] leading-relaxed text-g-ink">{agErro ? L(D.semAgenda) : L(D.semVaga)}</p>
              )}
              {agErro && slots && slots.length > 0 && <p role="alert" className="mt-3 text-[12.5px] font-semibold text-g-gold">{L(D.naoMarcou)}</p>}

              <a href={waLink("Guileo X-Ray")} target="_blank" rel="noreferrer" className="mt-4 inline-block text-[13px] font-bold text-g-green">{L(D.wa)} →</a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
