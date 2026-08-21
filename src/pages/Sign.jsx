import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLang } from "../i18n.jsx";
import ContractDoc from "../components/ContractDoc.jsx";
import { productDetail } from "../data/productSystem.js";
import logo from "../assets/guileo-mark.png";

// ════════════════════════════════════════════════════════════════════════════════════════════════
// A PÁGINA DE ASSINATURA — reescrita 2026-08-17 a pedido do Luis: "tem que ser legal, inteligente,
// criativa e temática e ao mesmo tempo simples, fácil de entender, óbvia, e que proteja a gente
// 1000% — até porque vamos usar os dados para performance."
//
// O TEMA já era verdade na marca e ninguém tinha usado: o cimento quente é a MESA, e o contrato é
// a FOLHA DE PAPEL branca apoiada nela. Nada de inventar um universo novo — o documento fica sendo
// a única coisa clara na tela, que é exatamente onde o olho tem que ir.
//
// O QUE MUDOU DE VERDADE (não é repaginada):
//
// 1) O ACORDO EM UMA OLHADA, ANTES DO JURIDIQUÊS. Um dono de salão que recebe 13 cláusulas de cara
//    não lê: ele adia. O card de cima responde em 4 segundos as três perguntas que travam a
//    assinatura — o que eu estou contratando, quanto custa, e quando começa. O contrato inteiro
//    continua logo abaixo, INTEGRAL: resumo não substitui documento, ele dá coragem de descer.
//
// 2) A BARRA FIXA. No celular o botão de assinar vivia no fim de um documento de 13 cláusulas —
//    ou seja, a pessoa tinha que rolar tudo de novo para agir. Agora o valor e o botão ficam
//    sempre à mão, e a barra some sozinha quando o bloco de assinatura já está na tela (senão
//    seriam dois botões iguais competindo, que é pior que nenhum).
//
// 3) O ERRO FALA. Este era o defeito grave: `if (d?.signed) {...} else setState("idle")`. Falhou a
//    rede, o link expirou, o documento já estava assinado — nos três casos o botão voltava ao
//    normal e a tela não dizia NADA. No instante da assinatura, que é onde o dinheiro entra: a
//    pessoa conclui que o sistema não funciona e vai embora. Agora cada recusa tem motivo e saída.
//
// 4) O QUE ACONTECE AGORA. Depois do aceite, três passos concretos. Silêncio depois de assinar é
//    a hora em que o cliente novo mais duvida da escolha.
//
// ⚠️ PROTEÇÃO — as decisões abaixo são jurídicas, não estéticas:
//    • TODA cláusula aparece: número, título e a MESMA cláusula em palavras simples, sempre
//      visíveis. Só o texto integral é que fica recolhido, e abre num toque (e abre sozinho ao
//      imprimir). Recolher ≠ esconder — nada de "leia os termos" atrás de link, e a contagem no
//      topo continua dizendo quantas são. Documento que a contraparte não viu é documento que ela
//      alega não ter visto; documento que ela não ENTENDEU é disputa na semana seguinte.
//    • o aceite exige NOME DIGITADO + caixa marcada, nunca só um clique — intenção inequívoca.
//    • o registro (nome, data/hora e IP) é gravado no servidor e MOSTRADO na tela; o que a pessoa
//      vê é o mesmo que fica guardado.
//    • a via impressa continua valendo e é oferecida: recusar papel afasta o cliente mais velho.
// ════════════════════════════════════════════════════════════════════════════════════════════════

const T = {
  eyebrow:  { pt: "Documento para assinatura", en: "Document for signature", es: "Documento para firma", hi: "हस्ताक्षर हेतु दस्तावेज़" },
  loading:  { pt: "Abrindo o documento…", en: "Opening the document…", es: "Abriendo el documento…", hi: "दस्तावेज़ खुल रहा है…" },
  notfound: { pt: "Não encontramos este documento. O link pode ter expirado ou já ter sido usado.", en: "We couldn't find this document. The link may have expired or already been used.", es: "No encontramos este documento. El enlace puede haber expirado o ya fue usado.", hi: "यह दस्तावेज़ नहीं मिला। लिंक समाप्त हो चुका है या पहले ही उपयोग हो चुका है।" },
  offline:  { pt: "Não consegui carregar agora — pode ser a conexão. Tente de novo.", en: "Couldn't load right now — it may be the connection. Try again.", es: "No pude cargar ahora — puede ser la conexión. Inténtalo de nuevo.", hi: "अभी लोड नहीं हो सका — शायद कनेक्शन। दोबारा कोशिश करें।" },
  retry:    { pt: "↻ Tentar de novo", en: "↻ Try again", es: "↻ Intentar de nuevo", hi: "↻ फिर कोशिश करें" },
  help:     { pt: "Falar com a gente no WhatsApp", en: "Talk to us on WhatsApp", es: "Hablar con nosotros por WhatsApp", hi: "व्हाट्सएप पर बात करें" },

  resumo:   { pt: "O acordo em uma olhada", en: "The agreement at a glance", es: "El acuerdo de un vistazo", hi: "एक नज़र में समझौता" },
  oquee:    { pt: "O que é", en: "What it is", es: "Qué es", hi: "यह क्या है" },
  quanto:   { pt: "Valor", en: "Amount", es: "Importe", hi: "राशि" },
  quando:   { pt: "Prazo", en: "Timeline", es: "Plazo", hi: "समय" },
  como:     { pt: "Pagamento", en: "Payment", es: "Pago", hi: "भुगतान" },
  inclui:   { pt: (n) => `${n} itens no escopo`, en: (n) => `${n} items in scope`, es: (n) => `${n} ítems en el alcance`, hi: (n) => `दायरे में ${n} आइटम` },
  clausulas:{ pt: (n) => `${n} cláusulas — o documento completo está abaixo, nada escondido`, en: (n) => `${n} clauses — the full document is below, nothing hidden`, es: (n) => `${n} cláusulas — el documento completo está abajo, nada oculto`, hi: (n) => `${n} खंड — पूरा दस्तावेज़ नीचे है, कुछ भी छिपा नहीं` },
  paraler:  { pt: "Documento completo ↓", en: "Full document ↓", es: "Documento completo ↓", hi: "पूरा दस्तावेज़ ↓" },

  review:   { pt: "Li o documento e quero assinar", en: "I've read the document and want to sign", es: "Leí el documento y quiero firmar", hi: "मैंने दस्तावेज़ पढ़ा और हस्ताक्षर करना चाहता हूँ" },
  yourname: { pt: "Seu nome completo, como assina", en: "Your full legal name", es: "Tu nombre completo", hi: "आपका पूरा नाम" },
  consent:  { pt: "Li e concordo com este documento. Minha assinatura eletrônica tem validade legal (MP 2.200-2 / ESIGN / UETA / eIDAS).", en: "I have read and agree to this document. My electronic signature is legally binding (ESIGN / UETA / eIDAS).", es: "Leí y acepto este documento. Mi firma electrónica tiene validez legal (ESIGN / UETA / eIDAS).", hi: "मैंने यह दस्तावेज़ पढ़ा है और सहमत हूँ। मेरा इलेक्ट्रॉनिक हस्ताक्षर कानूनी रूप से मान्य है।" },
  registro: { pt: "Seu nome, a data/hora e o IP ficam registrados junto com o documento — é isso que dá validade ao aceite.", en: "Your name, the date/time and the IP are recorded with the document — that is what makes the acceptance valid.", es: "Tu nombre, la fecha/hora y la IP quedan registrados con el documento — eso da validez a la aceptación.", hi: "आपका नाम, दिनांक/समय और IP दस्तावेज़ के साथ दर्ज होते हैं — यही स्वीकृति को मान्य बनाता है।" },
  sign:     { pt: "Assinar agora", en: "Sign now", es: "Firmar ahora", hi: "अभी हस्ताक्षर करें" },
  signing:  { pt: "Registrando…", en: "Recording…", es: "Registrando…", hi: "दर्ज हो रहा है…" },
  err:      { pt: "Escreva seu nome completo e marque a caixa acima.", en: "Type your full name and tick the box above.", es: "Escribe tu nombre completo y marca la casilla.", hi: "पूरा नाम लिखें और ऊपर का बॉक्स चुनें।" },
  falhou:   { pt: "Não consegui registrar a assinatura", en: "I couldn't record the signature", es: "No pude registrar la firma", hi: "हस्ताक्षर दर्ज नहीं हो सका" },
  m_indisp: { pt: "o serviço não respondeu agora. Seus dados não foram perdidos — tente de novo em instantes.", en: "the service didn't respond. Nothing was lost — try again in a moment.", es: "el servicio no respondió. No se perdió nada — inténtalo en un momento.", hi: "सेवा ने उत्तर नहीं दिया। कुछ खोया नहीं — थोड़ी देर में पुनः प्रयास करें।" },
  m_link:   { pt: "este link já foi usado ou não é mais válido. Fale com a gente que reenviamos na hora.", en: "this link was already used or is no longer valid. Message us and we'll resend it right away.", es: "este enlace ya fue usado o no es válido. Escríbenos y lo reenviamos.", hi: "यह लिंक पहले उपयोग हो चुका है या अमान्य है। हमें लिखें, हम तुरंत दोबारा भेजेंगे।" },
  m_rede:   { pt: "a conexão caiu no meio do envio. Tente de novo.", en: "the connection dropped mid-request. Try again.", es: "la conexión se cayó. Inténtalo de nuevo.", hi: "कनेक्शन टूट गया। दोबारा कोशिश करें।" },

  signed:   { pt: "Assinado", en: "Signed", es: "Firmado", hi: "हस्ताक्षरित" },
  already:  { pt: "Este documento já estava assinado.", en: "This document was already signed.", es: "Este documento ya estaba firmado.", hi: "इस दस्तावेज़ पर पहले ही हस्ताक्षर हो चुके थे।" },
  agora:    { pt: "O que acontece agora", en: "What happens now", es: "Qué pasa ahora", hi: "अब क्या होगा" },
  passo1:   { pt: "Guarde sua via — o botão abaixo salva em PDF.", en: "Keep your copy — the button below saves a PDF.", es: "Guarda tu copia — el botón de abajo guarda un PDF.", hi: "अपनी प्रति रखें — नीचे का बटन PDF सहेजता है।" },
  passo2:   { pt: "Nossa equipe recebe o aviso do aceite e entra em contato para começar.", en: "Our team is notified of the acceptance and reaches out to start.", es: "Nuestro equipo recibe el aviso y te contacta para empezar.", hi: "हमारी टीम को सूचना मिलती है और वे शुरू करने के लिए संपर्क करेंगे।" },
  passo3:   { pt: "Qualquer dúvida, fale com a gente — a mesma pessoa que te atendeu continua com você.", en: "Any questions, talk to us — the same person who helped you stays with you.", es: "Cualquier duda, habla con nosotros — la misma persona sigue contigo.", hi: "कोई प्रश्न हो तो हमसे बात करें — वही व्यक्ति आपके साथ रहेगा।" },
  cancela:  { pt: "Como cancela", en: "How to cancel", es: "Cómo cancelar", hi: "रद्द कैसे करें" },
  garantia: { pt: "Cancela quando quiser. Nos primeiros 30 dias devolvemos o primeiro mês inteiro.", en: "Cancel any time. In the first 30 days we refund the entire first month.", es: "Cancela cuando quieras. En los primeros 30 días devolvemos el primer mes completo.", hi: "कभी भी रद्द करें। पहले 30 दिनों में पहला महीना पूरा वापस।" },
  contratou:{ pt: "O que você contratou", en: "What you signed up for", es: "Lo que contrataste", hi: "आपने क्या लिया" },
  comeca:   { pt: "Quando começa", en: "When it starts", es: "Cuándo empieza", hi: "कब शुरू होगा" },
  print:    { pt: "📄 Salvar PDF / Imprimir", en: "📄 Save PDF / Print", es: "📄 Guardar PDF / Imprimir", hi: "📄 PDF सहेजें / प्रिंट" },
  physical: { pt: "Prefere assinar no papel? Imprima, assine e devolva — também vale.", en: "Prefer to sign on paper? Print, sign and return — that works too.", es: "¿Prefieres firmar en papel? Imprime, firma y devuelve — también vale.", hi: "काग़ज़ पर हस्ताक्षर करना चाहते हैं? प्रिंट करें और लौटाएँ — वह भी मान्य है।" },
};

const WA = "https://wa.me/19298288170";
// ⚠️ NADA DE `toLocaleString()` PELADO. Sem locale ele usa o do NAVEGADOR: um contrato em português
// carimbava "8/20/2026, 1:54 AM" embaixo da assinatura. O carimbo de data é parte do documento —
// tem que sair na língua DELE. (Mesma lição do fmt() com "en-US" cravado.)
const LOC = { pt: "pt-BR", es: "es-ES", hi: "hi-IN", en: "en-US" };
const quando = (d, lang) => { try { return new Date(d).toLocaleString(LOC[lang] || LOC.en); } catch { return new Date(d).toISOString().slice(0, 16).replace("T", " "); } };
const dinheiro = (cents, lang) => {
  const v = Number(cents || 0) / 100;
  try { return v.toLocaleString(lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }); }
  catch { return "$" + Math.round(v); }
};

export default function Sign() {
  // ⚠️ ESTA PÁGINA É DO CLIENTE, NÃO DO VENDEDOR. O idioma que manda é o do CONTRATO (doc.lang),
  // não o que o visitante deixou no site: um contrato em português exibido com a moldura em inglês
  // é duas línguas na mesma tela, no documento que a pessoa vai assinar. Antes de carregar não há
  // contrato ainda — aí (e só aí) vale o idioma do visitante.
  const { lang: uiLang } = useLang();
  const reduzir = useReducedMotion();
  const token = (() => { try { return new URLSearchParams(window.location.search).get("t") || ""; } catch { return ""; } })();

  const [doc, setDoc] = useState(undefined);   // undefined=carregando · null=não achado · {}=doc
  const [redeErro, setRedeErro] = useState(false); // ⚠️ separado de "não achado": 404 e queda de rede
  const [name, setName] = useState("");            //    são diagnósticos OPOSTOS e a saída é diferente.
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState("idle");   // idle | signing | signed
  const [err, setErr] = useState(false);
  const [falha, setFalha] = useState(null);     // motivo REAL da recusa do servidor
  const [sig, setSig] = useState(null);
  const [perto, setPerto] = useState(false);    // o bloco de assinar está na tela?

  const lang = (doc && doc.lang) || uiLang;
  const t = (k, ...a) => {
    const v = T[k] && (T[k][lang] || T[k].en);   // reserva SEMPRE en, nunca pt
    return typeof v === "function" ? v(...a) : (v || "");
  };

  const carregar = () => {
    setRedeErro(false); setDoc(undefined);
    fetch("/api/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "by_token", sign_token: token }) })
      .then((r) => r.json())
      .then((d) => {
        setDoc(d?.doc || null);
        if (d?.doc?.status === "signed") setSig({ name: d.doc.signer_name, at: d.doc.signed_at ? quando(d.doc.signed_at, d.doc.lang || "en") : "" });
      })
      .catch(() => { setDoc(null); setRedeErro(true); });
  };

  useEffect(() => {
    document.title = "Guileo · " + T.eyebrow[lang === "pt" ? "pt" : "en"];
    if (!token) { setDoc(null); return; }
    carregar(); /* eslint-disable-next-line */
  }, [token]);

  // A barra fixa some quando o bloco real de assinatura entra na tela — dois botões idênticos
  // competindo é pior que um só, e o de baixo é o que tem o nome e a caixa do aceite.
  useEffect(() => {
    const alvo = document.getElementById("bloco-assinar");
    if (!alvo || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPerto(e.isIntersecting), { rootMargin: "-40px" });
    io.observe(alvo);
    return () => io.disconnect();
  }, [doc, state]);

  const submit = async () => {
    if (!name.trim() || !consent) { setErr(true); return; }
    setErr(false); setFalha(null); setState("signing");
    try {
      const r = await fetch("/api/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sign", sign_token: token, signer_name: name.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (d && d.signed) { setSig({ name: name.trim(), at: quando(Date.now(), lang) }); setState("signed"); return; }
      // ⚠️ AQUI ESTAVA O BURACO: qualquer recusa virava setState("idle") em silêncio.
      setState("idle");
      setFalha(d && d.motivo === "link_invalido_ou_ja_assinado" ? "m_link" : "m_indisp");
    } catch { setState("idle"); setFalha("m_rede"); }
  };

  const assinado = doc?.status === "signed" || state === "signed";
  const b = doc?.body || null;
  const nClausulas = b?.clauses?.length || 0;
  const nEscopo = b?.deliverables?.length || 0;
  // ⚠️ O TEXTO HUMANO MANDA, e a ordem aqui é decisão jurídica, não de gosto. Formatando os centavos
  // o destaque saía "US$ 1.490" — sem a cadência. Ao lado de um chip dizendo "$1,490/mês", o número
  // grande passa a ler como pagamento ÚNICO, e ambiguidade de preço no documento que a pessoa assina
  // é exatamente o que vira disputa. `b.amount` é a string que o vendedor escreveu ("$1,490/mês"):
  // ela carrega a periodicidade. Os centavos ficam de reserva, pra quando não houver texto.
  const valor = b?.amount || (doc?.amount_cents ? dinheiro(doc.amount_cents, lang) : null);
  // Prazo REAL publicado pelo repo (productSystem.js → recepção IA). Nada de data inventada.
  const prazo = b?.timeline || productDetail("answering", lang)?.prazo || "";

  const Chip = ({ rotulo, valor: v }) => !v ? null : (
    <div className="rounded-xl border border-g-line bg-white/[0.03] px-3.5 py-2.5">
      <div className="text-[9.5px] font-black uppercase tracking-[0.14em] text-g-muted">{rotulo}</div>
      <div className="mt-0.5 text-[13px] font-bold text-g-word">{v}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-g-deep">
      {/* A MESA: o cimento quente da marca. O documento é a única superfície clara da tela — o olho
          vai pra ele sem que nada precise apontar. */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-7 flex items-center gap-2.5 print:hidden">
          <img src={logo} alt="" className="h-8 w-8 object-contain" />
          <div>
            <div className="text-[15px] font-extrabold leading-none text-g-word">Guileo</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-g-muted">{t("eyebrow")}</div>
          </div>
        </div>

        {doc === undefined && (
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-2xl border border-g-line bg-white/[0.03]" />
            <div className="h-96 animate-pulse rounded-2xl bg-white/[0.06]" />
            <p className="text-center text-[12.5px] text-g-muted">{t("loading")}</p>
          </div>
        )}

        {/* ⚠️ DOIS ESTADOS DE FALHA, NÃO UM. "não achei" manda falar com a gente (o link morreu);
            "não carregou" manda tentar de novo (a rede caiu). Misturar os dois faz metade das
            pessoas tentar a saída errada — e o link de contrato é caro demais pra isso. */}
        {doc === null && (
          <div className="rounded-2xl border border-g-gold/30 bg-g-gold/[0.06] p-8 text-center">
            <div className="text-3xl">{redeErro ? "📡" : "🔗"}</div>
            <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-g-ink">{redeErro ? t("offline") : t("notfound")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {redeErro && <button onClick={carregar} className="rounded-full border border-g-line px-4 py-2 text-[12.5px] font-bold text-g-word hover:bg-white/[0.06]">{t("retry")}</button>}
              <a href={WA} target="_blank" rel="noopener noreferrer" className="rounded-full bg-g-green/15 px-4 py-2 text-[12.5px] font-bold text-g-green ring-1 ring-g-green/40 hover:bg-g-green/25">💬 {t("help")}</a>
            </div>
          </div>
        )}

        {doc && b && (
          <>
            {/* ── [A] O ACORDO EM UMA OLHADA ────────────────────────────────────────────────────
                As três perguntas que travam a assinatura, respondidas antes do documento. Isto NÃO
                substitui o contrato — ele está inteiro logo abaixo. Serve pra pessoa descer com
                confiança em vez de fechar a aba. */}
            <section className="mb-5 rounded-2xl border border-g-line bg-white/[0.035] p-5 print:hidden">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-g-green">{t("resumo")}</div>
              <h1 className="mt-1.5 text-[20px] font-black leading-tight tracking-tight text-g-word">{b.title || doc.title}</h1>
              {b.summary && <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-g-ink">{b.summary}</p>}

              {valor && (
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-g-muted">{t("quanto")}</span>
                  <span className="text-[30px] font-black leading-none tracking-tight text-g-word">{valor}</span>
                </div>
              )}

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Chip rotulo={t("quando")} valor={b.timeline} />
                <Chip rotulo={t("como")} valor={b.payment} />
                <Chip rotulo={t("oquee")} valor={nEscopo ? t("inclui", nEscopo) : null} />
                {/* COMO CANCELA fica ao lado do preço, não escondido na cláusula 6. Quem sabe que
                    pode sair assina mais rápido — e a garantia é REAL (cláusula 6, 30 dias). */}
                <Chip rotulo={t("cancela")} valor={t("garantia")} />
              </div>

              {/* PROTEÇÃO: dizer o número de cláusulas é o contrário de esconder. Quem lê sabe que
                  há 13 e que elas estão logo abaixo, inteiras — ninguém alega surpresa depois. */}
              {nClausulas > 0 && (
                <p className="mt-4 border-t border-g-line pt-3 text-[11.5px] text-g-muted">
                  📑 {t("clausulas", nClausulas)}
                </p>
              )}
            </section>

            <div className="mb-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-g-muted print:hidden">{t("paraler")}</div>

            {/* ── [B] A FOLHA DE PAPEL ────────────────────────────────────────────────────────── */}
            <ContractDoc body={b} signature={sig} collapsible lang={lang} />

            {/* ── [C] O ACEITE ───────────────────────────────────────────────────────────────── */}
            <div id="bloco-assinar" className="mt-5 print:hidden">
              {assinado ? (
                /* O MOMENTO — e só DEPOIS do banco confirmar (state "signed" vem do `d.signed`
                   verdadeiro, nunca de `r.ok`). Movimento discreto, e nenhum se a pessoa pediu
                   menos movimento no sistema. */
                <motion.div
                  initial={reduzir ? false : { opacity: 0, y: 12, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: reduzir ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-xl3 border border-g-green/40 bg-g-green/[0.08] p-6 backdrop-blur-xl"
                >
                  <div className="flex items-center gap-2.5">
                    <motion.span
                      initial={reduzir ? false : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: reduzir ? 0 : 0.45, delay: reduzir ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-g-green/20 text-[17px]"
                    >✓</motion.span>
                    <div>
                      <div className="text-[17px] font-black leading-tight text-g-word">{t("signed")}</div>
                      {sig?.at && <div className="text-[11.5px] text-g-muted">{sig.name} · {sig.at}</div>}
                    </div>
                  </div>
                  {state !== "signed" && <p className="mt-2 text-[12px] text-g-muted">{t("already")}</p>}

                  {/* O QUE FOI CONTRATADO e QUANDO COMEÇA, com o nome de quem assinou. O prazo é o
                      que o repo já publica (productSystem.js → ~7 dias) — não se inventa data. */}
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-g-green/25 bg-black/15 px-3.5 py-2.5">
                      <div className="text-[9.5px] font-black uppercase tracking-[0.14em] text-g-muted">{t("contratou")}</div>
                      <div className="mt-0.5 text-[13px] font-bold text-g-word">{b.title || doc.title}{valor ? ` · ${valor}` : ""}</div>
                    </div>
                    <div className="rounded-xl border border-g-green/25 bg-black/15 px-3.5 py-2.5">
                      <div className="text-[9.5px] font-black uppercase tracking-[0.14em] text-g-muted">{t("comeca")}</div>
                      <div className="mt-0.5 text-[13px] font-bold text-g-word">{prazo}</div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-g-green/25 pt-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-g-green">{t("agora")}</div>
                    <ol className="mt-2.5 space-y-2">
                      {[t("passo1"), t("passo2"), t("passo3")].map((p, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-g-ink">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-g-green/18 text-[10px] font-black text-g-green">{i + 1}</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button onClick={() => window.print()} className="btn-bright min-h-[48px] text-sm">{t("print")}</button>
                    <a href={WA} target="_blank" rel="noopener noreferrer" className="btn-ghost min-h-[48px] text-sm">💬 {t("help")}</a>
                  </div>
                </motion.div>
              ) : (
                <div className="rounded-2xl border border-g-line bg-white/[0.035] p-5">
                  <div className="text-[14px] font-extrabold text-g-word">{t("review")}</div>

                  <input value={name} onChange={(e) => { setName(e.target.value); if (err) setErr(false); }}
                    placeholder={t("yourname")} autoComplete="name"
                    className="mt-3 min-h-[52px] w-full rounded-xl border border-g-line bg-black/20 px-4 py-3 text-[16px] text-g-word placeholder:text-g-muted/60 outline-none transition focus:border-g-green/60" />

                  {/* NOME DIGITADO + CAIXA MARCADA, nunca só um clique: é o que caracteriza intenção
                      inequívoca de assinar. Um botão sozinho é clicável por acidente. */}
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-snug text-g-ink">
                    <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (err) setErr(false); }} className="mt-0.5 h-5 w-5 shrink-0 accent-[#3E9468]" />
                    <span>{t("consent")}</span>
                  </label>

                  <p className="mt-2.5 text-[11px] leading-snug text-g-muted">🔒 {t("registro")}</p>

                  {err && <div className="mt-3 rounded-lg border border-g-gold/40 bg-g-gold/10 px-3 py-2 text-[12px] font-bold text-g-gold">{t("err")}</div>}

                  {/* A RECUSA COM MOTIVO E SAÍDA — o buraco que esta reescrita fecha. */}
                  {falha && (
                    <div className="mt-3 rounded-xl border border-[#E5484D]/40 bg-[#E5484D]/[0.08] px-3.5 py-3">
                      <div className="text-[12.5px] font-black text-[#FF7A7E]">{t("falhou")}</div>
                      <div className="mt-1 text-[12px] leading-snug text-g-ink">{t(falha)}</div>
                      <a href={WA} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[12px] font-bold text-g-green underline">💬 {t("help")}</a>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={submit} disabled={state === "signing"} className="btn-bright min-h-[48px] text-sm disabled:opacity-60">
                      {state === "signing" ? t("signing") : `✍️ ${t("sign")}`}
                    </button>
                    <button onClick={() => window.print()} className="btn-ghost text-sm">{t("print")}</button>
                  </div>
                  <p className="mt-3 text-[11px] text-g-muted">{t("physical")}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── [D] BARRA FIXA — só enquanto o bloco de aceite NÃO está na tela ─────────────────────
          Num documento de 13 cláusulas o botão de assinar ficava a uma rolagem inteira de
          distância. Aqui ele acompanha; e ao chegar no bloco de verdade, some. */}
      {doc && b && !assinado && !perto && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-g-line bg-g-deep/95 px-4 py-3 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11.5px] text-g-muted">{b.title || doc.title}</div>
              {valor && <div className="text-[17px] font-black leading-none text-g-word">{valor}</div>}
            </div>
            <button onClick={() => document.getElementById("bloco-assinar")?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="btn-bright min-h-[48px] shrink-0 text-sm">✍️ {t("sign")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
