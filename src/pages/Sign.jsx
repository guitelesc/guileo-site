import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLang } from "../i18n.jsx";
import ContractDoc, { LANG_NAME, diaLocal } from "../components/ContractDoc.jsx";
import { productDetail } from "../data/productSystem.js";
import logo from "../assets/guileo-mark.png";
import "./Sign.natura.css";   // tudo escopado em .sign-natura — sem o tema, nenhuma regra encosta

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
  // ── assinatura própria v2 (2026-10-04) ──
  governa:  { pt: (g) => ` A versão em ${g} é a que vale; outras línguas são tradução de cortesia.`, en: (g) => ` The ${g} version is the governing text; other languages are courtesy translations.`, es: (g) => ` La versión en ${g} es la que vale; otros idiomas son traducción de cortesía.`, hi: (g) => ` ${g} संस्करण ही मान्य पाठ है; अन्य भाषाएँ शिष्टाचार अनुवाद हैं।` },
  registro2:{ pt: "Seu nome, a data/hora, o IP, o navegador e a impressão digital SHA-256 do documento ficam registrados — é isso que dá validade ao aceite.", en: "Your name, the date/time, the IP, the browser and the document's SHA-256 fingerprint are recorded — that is what makes the acceptance valid.", es: "Tu nombre, la fecha/hora, la IP, el navegador y la huella SHA-256 del documento quedan registrados — eso da validez a la aceptación.", hi: "आपका नाम, दिनांक/समय, IP, ब्राउज़र और दस्तावेज़ का SHA-256 फ़िंगरप्रिंट दर्ज होते हैं — यही स्वीकृति को मान्य बनाता है।" },
  provOk:   { pt: (e, n, c, d) => `Assinado por ${e} — ${n}${c ? `, ${c}` : ""}, ${d}`, en: (e, n, c, d) => `Signed by ${e} — ${n}${c ? `, ${c}` : ""}, ${d}`, es: (e, n, c, d) => `Firmado por ${e} — ${n}${c ? `, ${c}` : ""}, ${d}`, hi: (e, n, c, d) => `${e} द्वारा हस्ताक्षरित — ${n}${c ? `, ${c}` : ""}, ${d}` },
  espTit:   { pt: "Aguardando a assinatura da ORIGEM LTDA", en: "Waiting for ORIGEM LTDA to sign first", es: "Esperando la firma de ORIGEM LTDA", hi: "ORIGEM LTDA के हस्ताक्षर की प्रतीक्षा" },
  espTxt:   { pt: "Neste documento a ORIGEM LTDA (Guileo AI) assina primeiro. Você já pode ler tudo; este mesmo link libera a sua assinatura assim que a nossa estiver registrada — nada muda no texto.", en: "On this document ORIGEM LTDA (Guileo AI) signs first. You can read everything now; this same link opens your signature as soon as ours is recorded — the text will not change.", es: "En este documento ORIGEM LTDA (Guileo AI) firma primero. Ya puedes leer todo; este mismo enlace habilita tu firma en cuanto la nuestra quede registrada — el texto no cambia.", hi: "इस दस्तावेज़ पर ORIGEM LTDA (Guileo AI) पहले हस्ताक्षर करता है। आप अभी सब पढ़ सकते हैं; हमारे हस्ताक्षर दर्ज होते ही यही लिंक आपका हस्ताक्षर खोल देगा — पाठ नहीं बदलेगा।" },
  advOff:   { pt: "O registro avançado (impressão digital do documento e contra-assinatura) ainda não está ativo nesta página. Sua assinatura continua registrada com nome, data/hora e IP.", en: "The advanced record (document fingerprint and countersignature) is not active on this page yet. Your signature is still recorded with name, date/time and IP.", es: "El registro avanzado (huella del documento y contrafirma) aún no está activo en esta página. Tu firma sigue registrada con nombre, fecha/hora e IP.", hi: "उन्नत रिकॉर्ड (दस्तावेज़ फ़िंगरप्रिंट और प्रति-हस्ताक्षर) इस पेज पर अभी सक्रिय नहीं है। आपका हस्ताक्षर फिर भी नाम, दिनांक/समय और IP के साथ दर्ज होता है।" },
  m_espera: { pt: "a ORIGEM LTDA ainda não assinou este documento. Assim que assinar, este mesmo link libera a sua assinatura.", en: "ORIGEM LTDA hasn't signed this document yet. As soon as it does, this same link opens your signature.", es: "ORIGEM LTDA aún no firmó este documento. En cuanto lo haga, este mismo enlace habilita tu firma.", hi: "ORIGEM LTDA ने अभी तक हस्ताक्षर नहीं किए हैं। हस्ताक्षर होते ही यही लिंक आपका हस्ताक्षर खोल देगा।" },
  m_mudou:  { pt: "o documento foi atualizado depois que você abriu esta página. Recarregue para ler a versão atual antes de assinar.", en: "the document was updated after you opened this page. Reload to read the current version before signing.", es: "el documento se actualizó después de que abriste esta página. Recarga para leer la versión actual antes de firmar.", hi: "आपके पेज खोलने के बाद दस्तावेज़ अपडेट हुआ। हस्ताक्षर से पहले वर्तमान संस्करण पढ़ने के लिए रीलोड करें।" },
  reload:   { pt: "↻ Recarregar", en: "↻ Reload", es: "↻ Recargar", hi: "↻ रीलोड" },
  copiaOk:  { pt: "Enviamos uma via por e-mail para você, com a impressão digital do documento.", en: "We emailed you a copy, with the document's fingerprint.", es: "Te enviamos una copia por correo, con la huella del documento.", hi: "हमने आपको दस्तावेज़ के फ़िंगरप्रिंट के साथ एक प्रति ईमेल की है।" },
  copiaNao: { pt: "A via por e-mail não saiu agora — nossa equipe já foi avisada. Salve o PDF abaixo; este link continua valendo como sua via.", en: "The email copy didn't go out right now — our team has been alerted. Save the PDF below; this link stays valid as your copy.", es: "La copia por correo no salió ahora — nuestro equipo ya fue avisado. Guarda el PDF abajo; este enlace sigue valiendo como tu copia.", hi: "ईमेल प्रति अभी नहीं गई — हमारी टीम को सूचित कर दिया गया है। नीचे PDF सहेजें; यह लिंक आपकी प्रति के रूप में मान्य रहेगा।" },
  idioma:   { pt: "Idioma do documento", en: "Document language", es: "Idioma del documento", hi: "दस्तावेज़ की भाषा" },
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

// ── A MESMA IMPRESSÃO DIGITAL DO SERVIDOR (functions/api/contract.js → canonicalJSON) ───────────
// A página recalcula o SHA-256 do que está NA TELA e compara com o que o banco gravou na assinatura.
// Se divergir, a tela diz — em vermelho. Mudou o algoritmo lá, muda aqui no mesmo commit.
function canonicalJSON(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? JSON.stringify(v) : "null";
  if (typeof v === "boolean" || typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map((x) => (x === undefined || typeof x === "function" ? "null" : canonicalJSON(x))).join(",") + "]";
  if (typeof v === "object") {
    const ks = Object.keys(v).filter((k) => v[k] !== undefined && typeof v[k] !== "function").sort();
    return "{" + ks.map((k) => JSON.stringify(k) + ":" + canonicalJSON(v[k])).join(",") + "}";
  }
  return "null";
}
async function hashDoc(doc) {
  const txt = canonicalJSON({ body: doc?.body ?? {}, title: doc?.title ?? null, lang: doc?.lang ?? null });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ── MOCK SÓ DE DESENVOLVIMENTO ─────────────────────────────────────────────────────────────────
// /sign?t=mock-sign | mock-wait | mock-signed | mock-joinder | mock-legacy — só existe com
// `npx vite` (import.meta.env.DEV). No build de produção esta constante vira `null` e o fixture
// inteiro sai do bundle (conferido com grep no dist). Nunca fala com o banco.
const DEV_MOCK = import.meta.env.DEV ? (tok) => {
  if (!/^mock-/.test(tok)) return null;
  const items = (arr) => arr.map(([text, status]) => ({ text, status }));
  const base = {
    theme: "natura-deck", governing_lang: "en", provider_signs_first: true, doc_label: "Services Agreement", template_code: "MSA-NATURA-01", date: "October 4, 2026",
    title: "Services Agreement — AI Front Desk & Growth Systems",
    subtitle: "ORIGEM LTDA d/b/a Guileo AI ↔ Natura Spa NYC Inc.",
    provider: { name: "ORIGEM LTDA d/b/a Guileo AI", qualificacao: "Represented by Luis Teles, Managing Partner" },
    counterparty: { name: "Natura Spa NYC Inc.", qualificacao: "New York corporation", email: "owner@naturaspa.example" },
    summaryRows: [["Term", "12 months, renews monthly after"], ["Monthly fee", "$1,997 / month"], ["Start", "On signature"], ["Governing law", "State of New York"]],
    summary: "Guileo AI operates the spa's AI front desk, booking and messaging systems as described in Annex A.",
    clauses: [
      [1, "Services", "Provider will deliver the services listed in Annex A, at the status shown for each item.", "We run what Annex A lists."],
      [2, "Fees", "Client pays the monthly fee in advance on the 1st of each month.", "Monthly, in advance."],
      [3, "Governing law", "This Agreement is governed by the laws of the State of New York.", "New York law."],
    ],
    annexes: [{ title: "Scope and status of each system", intro: "Each line shows where the system stands on the signature date.", parts: [
      { title: "Voice & front desk", terms: "Included in the monthly fee.", items: items([["AI voice receptionist 24/7", "live"], ["Booking into MindBody", "activation"], ["SMS confirmations (A2P approval)", "pending"]]) },
      { title: "Growth", terms: ["Requires Client approval of each campaign."], items: items([["Google review engine", "ready"], ["Meta ads management", "planned"], ["Custom mobile app", "future"]]) },
    ] }],
    disclaimer: "This is a binding legal agreement. Read it fully before signing.",
  };
  base.translations = { pt: {
    title: "Contrato de Prestação de Serviços — Recepção com IA e Sistemas de Crescimento", doc_label: "Contrato de Serviços",
    summaryRows: [["Prazo", "12 meses, depois renova mês a mês"], ["Mensalidade", "US$ 1.997 / mês"], ["Início", "Na assinatura"], ["Lei aplicável", "Estado de Nova York"]],
    summary: "A Guileo AI opera a recepção com IA, a agenda e as mensagens do spa, conforme o Anexo A.",
    clauses: [[1, "Serviços", "O Prestador entregará os serviços do Anexo A, no status indicado em cada item.", "Fazemos o que o Anexo A lista."], [2, "Valores", "O Cliente paga a mensalidade antecipadamente no dia 1º de cada mês.", "Mensal, adiantado."], [3, "Lei aplicável", "Este Contrato é regido pelas leis do Estado de Nova York.", "Lei de Nova York."]],
    annexes: [{ title: "Escopo e status de cada sistema", intro: "Cada linha mostra onde o sistema está na data da assinatura.", parts: [
      { title: "Voz e recepção", terms: "Incluído na mensalidade.", items: items([["Recepcionista de voz com IA 24/7", "live"], ["Agendamento no MindBody", "activation"], ["Confirmações por SMS (aprovação A2P)", "pending"]]) },
      { title: "Crescimento", terms: ["Exige aprovação do Cliente para cada campanha."], items: items([["Motor de avaliações do Google", "ready"], ["Gestão de anúncios na Meta", "planned"], ["App próprio", "future"]]) },
    ] }],
    disclaimer: "Este é um contrato com efeito legal. Leia tudo antes de assinar.",
  } };
  const prov = { provider_entity: "ORIGEM LTDA", provider_signer_name: "Luis Teles", provider_signer_title: "Managing Partner", provider_signed_at: "2026-10-04T13:05:00Z", provider_ip: "203.0.113.7" };
  const doc = { id: "00000000-0000-0000-0000-000000000000", doc_kind: "contract", lang: "en", title: base.title, counterparty_name: "Natura Spa NYC Inc.", amount_cents: 199700, body: base, status: "sent", updated_at: "2026-10-04T13:05:00Z", parent_title: null };
  if (tok === "mock-wait") return { avancado: true, doc };
  if (tok === "mock-sign") return { avancado: true, doc: { ...doc, ...prov, provider_body_sha256: "pending" } };
  if (tok === "mock-signed") return { avancado: true, doc: { ...doc, ...prov, provider_body_sha256: "pending", status: "signed", signer_name: "Maria Silva", signed_at: "2026-10-05T14:22:10Z", signer_ip: "198.51.100.23", body_sha256: "pending" } };
  if (tok === "mock-tamper") return { avancado: true, doc: { ...doc, ...prov, provider_body_sha256: "0".repeat(64), status: "signed", signer_name: "Maria Silva", signed_at: "2026-10-05T14:22:10Z", signer_ip: "198.51.100.23", body_sha256: "0".repeat(64) } };
  if (tok === "mock-joinder") return { avancado: true, doc: { ...doc, ...prov, provider_body_sha256: "pending", body: { ...base, parent_contract_id: "11111111-1111-1111-1111-111111111111" }, parent_title: base.title, title: "Joinder — Guarantor" } };
  if (tok === "mock-legacy") return { avancado: false, doc: { ...doc, lang: "pt", title: "Recepção com IA", body: { title: "Recepção com IA", amount: "$497/mês", timeline: "No ar em até 7 dias", deliverables: ["Atendimento 24/7", "Agenda"], provider: { name: "Guileo" }, counterparty: { name: "Salão X" }, clauses: [[1, "Objeto", "Texto integral.", "Em palavras simples."]] } } };
  return null;
} : null;

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
  const [avancado, setAvancado] = useState(false); // SQL v2 ativo? (hash + contra-assinatura)
  const [viewLang, setViewLang] = useState(null);  // idioma em que a pessoa está LENDO
  const [verify, setVerify] = useState(null);      // null | "pending" | "ok" | "mismatch"
  const [copia, setCopia] = useState(null);        // resultado do envio das vias por e-mail

  const gov = (doc && (doc.body?.governing_lang || doc.lang)) || null;
  const traducoes = doc?.body?.translations && typeof doc.body.translations === "object" ? Object.keys(doc.body.translations).filter((k) => LANG_NAME[k] && k !== gov) : [];
  const lang = viewLang || gov || uiLang;
  const t = (k, ...a) => {
    const v = T[k] && (T[k][lang] || T[k].en);   // reserva SEMPRE en, nunca pt
    return typeof v === "function" ? v(...a) : (v || "");
  };

  const aplicar = (d) => {
    const dd = d?.doc || null;
    setAvancado(!!d?.avancado);
    setDoc(dd);
    if (dd) setViewLang((v) => v || dd.body?.governing_lang || dd.lang || null);
    if (dd?.status === "signed") setSig({ name: dd.signer_name, at: dd.signed_at ? quando(dd.signed_at, dd.lang || "en") : "", ip: dd.signer_ip || "" });
  };
  // `silencioso`: depois de assinar, relê o registro SEM apagar a tela — o que a pessoa vê passa a
  // ser exatamente o que o banco gravou (nome, hora, IP, hash).
  const carregar = (silencioso = false) => {
    if (!silencioso) { setRedeErro(false); setDoc(undefined); }
    if (DEV_MOCK && DEV_MOCK(token)) {
      const m = DEV_MOCK(token);
      hashDoc(m.doc).then((h) => {
        const doc2 = { ...m.doc };
        if (doc2.provider_body_sha256 === "pending") doc2.provider_body_sha256 = h;
        if (doc2.body_sha256 === "pending") doc2.body_sha256 = h;
        aplicar({ ...m, doc: doc2 });
      });
      return;
    }
    fetch("/api/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "by_token", sign_token: token }) })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        // ⚠️ 503 (banco fora) NÃO é "documento não existe" — vira o estado de rede, com "tentar de novo".
        if (!r.ok || !d || d.ok === false) { if (!silencioso) { setDoc(null); setRedeErro(true); } return; }
        aplicar(d);
      })
      .catch(() => { if (!silencioso) { setDoc(null); setRedeErro(true); } });
  };

  // a conferência da impressão digital, no navegador de quem lê
  useEffect(() => {
    const alvo = doc?.body_sha256 || doc?.provider_body_sha256;
    if (!doc || !alvo || typeof crypto === "undefined" || !crypto.subtle) { setVerify(null); return; }
    setVerify("pending");
    let vivo = true;
    hashDoc(doc).then((h) => { if (vivo) setVerify(h === alvo ? "ok" : "mismatch"); }).catch(() => { if (vivo) setVerify(null); });
    return () => { vivo = false; };
  }, [doc]);

  useEffect(() => {
    document.title = "Guileo · " + (T.eyebrow[lang] || T.eyebrow.en);
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
    if (DEV_MOCK && DEV_MOCK(token)) {   // dev: simula o recibo do servidor, nunca toca o banco
      const agora = new Date().toISOString();
      setDoc((d0) => ({ ...d0, status: "signed", signer_name: name.trim(), signed_at: agora, signer_ip: "127.0.0.1", body_sha256: d0.provider_body_sha256 || d0.body_sha256 }));
      setSig({ name: name.trim(), at: quando(agora, lang), ip: "127.0.0.1" }); setCopia({ cliente: true }); setState("signed"); return;
    }
    try {
      const r = await fetch("/api/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sign", sign_token: token, signer_name: name.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (d && d.signed) {
        setSig({ name: name.trim(), at: quando(d.recibo?.quando || Date.now(), lang), ip: d.recibo?.ip || "" });
        setCopia(d.copia || null);
        setState("signed");
        carregar(true);   // relê o que ficou GRAVADO (hash, IP, hora do servidor)
        return;
      }
      // ⚠️ AQUI ESTAVA O BURACO: qualquer recusa virava setState("idle") em silêncio.
      setState("idle");
      const mot = d && d.motivo;
      setFalha(mot === "link_invalido_ou_ja_assinado" ? "m_link" : mot === "aguardando_prestador" ? "m_espera" : mot === "documento_mudou" ? "m_mudou" : "m_indisp");
    } catch { setState("idle"); setFalha("m_rede"); }
  };

  const assinado = doc?.status === "signed" || state === "signed";
  // O QUE A PESSOA LÊ: o corpo no idioma que vale, ou a tradução de cortesia por cima dele (mesma
  // forma). Partes, tema, vínculo de adesão etc. vêm sempre do original.
  const original = doc?.body || null;
  const tr = original && viewLang && viewLang !== gov ? original.translations?.[viewLang] : null;
  const b = original ? (tr ? { ...original, ...tr, translations: undefined } : original) : null;
  const deck = Array.isArray(original?.summaryRows) && original.summaryRows.length > 0; // resumo próprio → sem os chips genéricos
  const exigePrestador = original?.provider_signs_first === true;
  const esperandoPrestador = avancado && exigePrestador && !doc?.provider_signed_at && !assinado;
  const record = avancado && doc ? {
    provider: doc.provider_signed_at ? { entity: doc.provider_entity || "ORIGEM LTDA", name: doc.provider_signer_name, title: doc.provider_signer_title, at: doc.provider_signed_at, ip: doc.provider_ip } : null,
    signer: doc.status === "signed" ? { name: doc.signer_name, atRaw: doc.signed_at, ip: doc.signer_ip } : null,
    hash: doc.body_sha256 || doc.provider_body_sha256 || null,
    providerHash: doc.provider_body_sha256 || null,
    verify, governing: gov, parentTitle: doc.parent_title || null,
  } : null;
  const nClausulas = b?.clauses?.length || 0;
  const nEscopo = b?.deliverables?.length || 0;
  // ⚠️ O TEXTO HUMANO MANDA, e a ordem aqui é decisão jurídica, não de gosto. Formatando os centavos
  // o destaque saía "US$ 1.490" — sem a cadência. Ao lado de um chip dizendo "$1,490/mês", o número
  // grande passa a ler como pagamento ÚNICO, e ambiguidade de preço no documento que a pessoa assina
  // é exatamente o que vira disputa. `b.amount` é a string que o vendedor escreveu ("$1,490/mês"):
  // ela carrega a periodicidade. Os centavos ficam de reserva, pra quando não houver texto.
  // Contrato com resumo próprio: só o valor ESCRITO (com a cadência) — centavos crus viram "$1,997"
  // sem "/mês" na barra fixa, a mesma ambiguidade de preço descrita acima.
  const valor = b?.amount || (!deck && doc?.amount_cents ? dinheiro(doc.amount_cents, lang) : null);
  // Prazo REAL publicado pelo repo (productSystem.js → recepção IA). Nada de data inventada.
  // ⚠️ Contrato com resumo próprio (summaryRows) NÃO herda o prazo do produto "answering": seria
  // uma promessa que o documento dele não faz.
  const prazo = b?.timeline || (deck ? "" : productDetail("answering", lang)?.prazo || "");

  // ── TEMA natura-deck NA PÁGINA INTEIRA (2026-10-04) ───────────────────────────────────────────
  // Antes só a folha tinha a cara do deck; a moldura continuava no cimento escuro do app. Com o
  // tema, a página toda vira o deck: papel claro, painéis brancos, rótulos espaçados, botão de
  // tinta, faixa escura de capa. `k(padrão, natura)` escolhe a classe — o ramo padrão é LITERALMENTE
  // a string de antes, então qualquer outro contrato sai byte a byte igual.
  const nd = original?.theme === "natura-deck";
  const k = (def, nat) => (nd ? nat : def);
  useEffect(() => {
    if (!nd || typeof document === "undefined") return;
    document.body.classList.add("sign-natura-body");
    return () => document.body.classList.remove("sign-natura-body");
  }, [nd]);

  const Chip = ({ rotulo, valor: v }) => !v ? null : (
    <div className={k("rounded-xl border border-g-line bg-white/[0.03] px-3.5 py-2.5", "sn-soft px-3.5 py-2.5")}>
      <div className={k("text-[9.5px] font-black uppercase tracking-[0.14em] text-g-muted", "sn-k")}>{rotulo}</div>
      <div className={k("mt-0.5 text-[13px] font-bold text-g-word", "sn-ink mt-0.5 text-[13.5px] font-semibold")}>{v}</div>
    </div>
  );

  return (
    <div className={k("min-h-screen bg-g-deep", "sign-natura min-h-screen")}>
      {/* A FAIXA DE CAPA — só no tema do deck: o mesmo fundo #161512 com filete de ouro da capa. */}
      {nd && (
        <div className="sn-band print:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-3.5">
            <img src={logo} alt="" className="sn-band-logo" />
            <div>
              <div className="sn-band-name">Guileo</div>
              <div className="sn-band-sub">{t("eyebrow")}</div>
            </div>
          </div>
        </div>
      )}
      {/* A MESA: o cimento quente da marca. O documento é a única superfície clara da tela — o olho
          vai pra ele sem que nada precise apontar. */}
      <div className={k("mx-auto max-w-3xl px-4 py-8 sm:py-12", "mx-auto max-w-3xl px-4 pb-8 pt-6 sm:pb-12 sm:pt-8")}>
        {!nd && <div className="mb-7 flex items-center gap-2.5 print:hidden">
          <img src={logo} alt="" className="h-8 w-8 object-contain" />
          <div>
            <div className="text-[15px] font-extrabold leading-none text-g-word">Guileo</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-g-muted">{t("eyebrow")}</div>
          </div>
        </div>}

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
              {redeErro && <button onClick={() => carregar()} className="rounded-full border border-g-line px-4 py-2 text-[12.5px] font-bold text-g-word hover:bg-white/[0.06]">{t("retry")}</button>}
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
            <section className={k("mb-5 rounded-2xl border border-g-line bg-white/[0.035] p-5 print:hidden", "sn-panel mb-6 p-5 sm:p-7 print:hidden")}>
              <div className={k("text-[10px] font-black uppercase tracking-[0.16em] text-g-green", "sn-eye")}>{t("resumo")}</div>
              <h1 className={k("mt-1.5 text-[20px] font-black leading-tight tracking-tight text-g-word", "sn-h1 mt-2")}>{b.title || doc.title}</h1>
              {b.summary && <p className={k("mt-2 max-w-2xl text-[13px] leading-relaxed text-g-ink", "sn-p mt-2.5 max-w-2xl text-[14px] leading-relaxed")}>{b.summary}</p>}

              {valor && !deck && (
                <div className="mt-4 flex items-baseline gap-2">
                  <span className={k("text-[10px] font-black uppercase tracking-[0.14em] text-g-muted", "sn-k")}>{t("quanto")}</span>
                  <span className={k("text-[30px] font-black leading-none tracking-tight text-g-word", "sn-ink text-[30px] font-extrabold leading-none tracking-tight")}>{valor}</span>
                </div>
              )}

              {/* SELETOR DE IDIOMA — só quando o documento traz tradução. A versão que vale é dita na
                  própria folha (faixa vermelha) e no texto do aceite. */}
              {traducoes.length > 0 && (
                <div className={k("mt-3 flex items-center gap-2", "mt-4 flex flex-wrap items-center gap-2.5")} role="group" aria-label={t("idioma")}>
                  <span className={k("text-[10px] font-black uppercase tracking-[0.14em] text-g-muted", "sn-k")}>{t("idioma")}</span>
                  <div className={k("inline-flex overflow-hidden rounded-full border border-g-line", "sn-seg")}>
                    {[gov, ...traducoes].map((l) => (
                      <button key={l} type="button" onClick={() => setViewLang(l)} aria-pressed={lang === l}
                        className={nd ? undefined : `min-h-[36px] px-3.5 text-[12px] font-black tracking-wide ${lang === l ? "bg-g-word text-g-deep" : "text-g-word hover:bg-white/[0.06]"}`}>
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!deck && <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Chip rotulo={t("quando")} valor={b.timeline} />
                <Chip rotulo={t("como")} valor={b.payment} />
                <Chip rotulo={t("oquee")} valor={nEscopo ? t("inclui", nEscopo) : null} />
                {/* COMO CANCELA fica ao lado do preço, não escondido na cláusula 6. Quem sabe que
                    pode sair assina mais rápido — e a garantia é REAL (cláusula 6, 30 dias). */}
                <Chip rotulo={t("cancela")} valor={t("garantia")} />
              </div>}

              {/* A CONTRA-ASSINATURA, à vista antes do documento: o cliente vê que já assinamos. */}
              {record?.provider && (nd ? (
                <p className="sn-pill-live mt-4 px-3.5 py-2.5 text-[12.5px] leading-snug">
                  <span>✓ {t("provOk", record.provider.entity, record.provider.name, record.provider.title, diaLocal(record.provider.at, lang))}</span>
                </p>
              ) : (
                <p className="mt-4 rounded-xl border border-g-green/30 bg-g-green/[0.07] px-3.5 py-2.5 text-[12.5px] font-bold text-g-word">
                  ✓ {t("provOk", record.provider.entity, record.provider.name, record.provider.title, diaLocal(record.provider.at, lang))}
                </p>
              ))}
              {!avancado && <p className={k("mt-3 text-[11px] leading-snug text-g-muted", "sn-muted mt-3 text-[12px] leading-snug")}>ⓘ {t("advOff")}</p>}

              {/* PROTEÇÃO: dizer o número de cláusulas é o contrário de esconder. Quem lê sabe que
                  há 13 e que elas estão logo abaixo, inteiras — ninguém alega surpresa depois. */}
              {nClausulas > 0 && (
                <p className={k("mt-4 border-t border-g-line pt-3 text-[11.5px] text-g-muted", "sn-rule sn-muted mt-5 pt-3.5 text-[12px]")}>
                  📑 {t("clausulas", nClausulas)}
                </p>
              )}
            </section>

            <div className={k("mb-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-g-muted print:hidden", "sn-k mb-2.5 print:hidden")}>{t("paraler")}</div>

            {/* ── [B] A FOLHA DE PAPEL ────────────────────────────────────────────────────────── */}
            <ContractDoc body={b} signature={sig} collapsible lang={lang} record={record} courtesy={tr ? gov : null} />

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
                  className={k("rounded-xl3 border border-g-green/40 bg-g-green/[0.08] p-6 backdrop-blur-xl", "sn-done p-5 sm:p-7")}
                >
                  <div className="flex items-center gap-2.5">
                    <motion.span
                      initial={reduzir ? false : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: reduzir ? 0 : 0.45, delay: reduzir ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
                      className={k("grid h-9 w-9 shrink-0 place-items-center rounded-full bg-g-green/20 text-[17px]", "sn-check-badge grid h-9 w-9 shrink-0 place-items-center rounded-full text-[17px] font-bold")}
                    >✓</motion.span>
                    <div>
                      <div className={k("text-[17px] font-black leading-tight text-g-word", "sn-ink text-[19px] font-extrabold leading-tight tracking-tight")}>{t("signed")}</div>
                      {sig?.at && <div className={k("text-[11.5px] text-g-muted", "sn-muted sn-mono text-[11.5px]")}>{sig.name} · {sig.at}</div>}
                    </div>
                  </div>
                  {state !== "signed" && <p className={k("mt-2 text-[12px] text-g-muted", "sn-muted mt-2.5 text-[12.5px]")}>{t("already")}</p>}
                  {state === "signed" && copia && (
                    <p className={nd ? `mt-2.5 text-[12.5px] ${copia.cliente ? "sn-p" : "sn-gold-t"}` : `mt-2 text-[12px] ${copia.cliente ? "text-g-ink" : "text-g-gold"}`}>{copia.cliente ? `✉️ ${t("copiaOk")}` : `⚠️ ${t("copiaNao")}`}</p>
                  )}

                  {/* O QUE FOI CONTRATADO e QUANDO COMEÇA, com o nome de quem assinou. O prazo é o
                      que o repo já publica (productSystem.js → ~7 dias) — não se inventa data. */}
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className={k("rounded-xl border border-g-green/25 bg-black/15 px-3.5 py-2.5", "sn-soft px-3.5 py-2.5")}>
                      <div className={k("text-[9.5px] font-black uppercase tracking-[0.14em] text-g-muted", "sn-k")}>{t("contratou")}</div>
                      <div className={k("mt-0.5 text-[13px] font-bold text-g-word", "sn-ink mt-0.5 text-[13.5px] font-semibold")}>{b.title || doc.title}{valor ? ` · ${valor}` : ""}</div>
                    </div>
                    {prazo && <div className={k("rounded-xl border border-g-green/25 bg-black/15 px-3.5 py-2.5", "sn-soft px-3.5 py-2.5")}>
                      <div className={k("text-[9.5px] font-black uppercase tracking-[0.14em] text-g-muted", "sn-k")}>{t("comeca")}</div>
                      <div className={k("mt-0.5 text-[13px] font-bold text-g-word", "sn-ink mt-0.5 text-[13.5px] font-semibold")}>{prazo}</div>
                    </div>}
                  </div>

                  <div className={k("mt-5 border-t border-g-green/25 pt-4", "sn-rule mt-5 pt-4")}>
                    <div className={k("text-[10px] font-black uppercase tracking-[0.16em] text-g-green", "sn-eye")}>{t("agora")}</div>
                    <ol className="mt-2.5 space-y-2">
                      {[t("passo1"), t("passo2"), t("passo3")].map((p, i) => (
                        <li key={i} className={k("flex gap-2.5 text-[13px] leading-relaxed text-g-ink", "sn-p flex gap-3 text-[13.5px] leading-relaxed")}>
                          <span className={k("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-g-green/18 text-[10px] font-black text-g-green", "sn-step w-5 shrink-0 text-[13.5px]")}>{nd ? String(i + 1).padStart(2, "0") : i + 1}</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button onClick={() => window.print()} className={k("btn-bright min-h-[48px] text-sm", "sn-btn")}>{t("print")}</button>
                    <a href={WA} target="_blank" rel="noopener noreferrer" className={k("btn-ghost min-h-[48px] text-sm", "sn-btn-ghost")}>💬 {t("help")}</a>
                  </div>
                </motion.div>
              ) : esperandoPrestador ? (
                /* PRESTADOR PRIMEIRO: sem a nossa assinatura não existe botão de assinar — e a tela
                   diz por quê, em vez de um botão que o servidor recusaria. */
                <div className={k("rounded-2xl border border-g-gold/40 bg-g-gold/[0.07] p-5", "sn-wait p-5 sm:p-6")}>
                  <div className={k("text-[14px] font-extrabold text-g-word", "sn-h2")}>⏳ {t("espTit")}</div>
                  <p className={k("mt-2 text-[12.5px] leading-relaxed text-g-ink", "sn-p mt-2 text-[13.5px] leading-relaxed")}>{t("espTxt")}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => carregar()} className={k("btn-ghost text-sm", "sn-btn-ghost")}>{t("reload")}</button>
                    <a href={WA} target="_blank" rel="noopener noreferrer" className={k("btn-ghost text-sm", "sn-btn-ghost")}>💬 {t("help")}</a>
                  </div>
                </div>
              ) : (
                <div className={k("rounded-2xl border border-g-line bg-white/[0.035] p-5", "sn-panel p-5 sm:p-7")}>
                  <div className={k("text-[14px] font-extrabold text-g-word", "sn-h2")}>{t("review")}</div>

                  <input value={name} onChange={(e) => { setName(e.target.value); if (err) setErr(false); }}
                    placeholder={t("yourname")} autoComplete="name" aria-label={nd ? t("yourname") : undefined}
                    className={k("mt-3 min-h-[52px] w-full rounded-xl border border-g-line bg-black/20 px-4 py-3 text-[16px] text-g-word placeholder:text-g-muted/60 outline-none transition focus:border-g-green/60", "sn-input mt-3.5")} />

                  {/* NOME DIGITADO + CAIXA MARCADA, nunca só um clique: é o que caracteriza intenção
                      inequívoca de assinar. Um botão sozinho é clicável por acidente. */}
                  <label className={k("mt-3 flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-snug text-g-ink", "sn-p mt-3.5 flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug")}>
                    <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (err) setErr(false); }} className={k("mt-0.5 h-5 w-5 shrink-0 accent-[#3E9468]", "sn-check mt-0.5 h-5 w-5 shrink-0")} />
                    <span>{t("consent")}{original?.governing_lang || traducoes.length ? t("governa", (LANG_NAME[gov] || {})[lang] || gov) : ""}</span>
                  </label>

                  <p className={k("mt-2.5 text-[11px] leading-snug text-g-muted", "sn-muted mt-3 text-[12px] leading-snug")}>🔒 {avancado ? t("registro2") : t("registro")}</p>

                  {err && <div className={k("mt-3 rounded-lg border border-g-gold/40 bg-g-gold/10 px-3 py-2 text-[12px] font-bold text-g-gold", "sn-warn mt-3 px-3 py-2 text-[12.5px] font-bold")} role={nd ? "alert" : undefined}>{t("err")}</div>}

                  {/* A RECUSA COM MOTIVO E SAÍDA — o buraco que esta reescrita fecha. */}
                  {falha && (
                    <div className={k("mt-3 rounded-xl border border-[#E5484D]/40 bg-[#E5484D]/[0.08] px-3.5 py-3", "sn-err mt-3 px-3.5 py-3")} role={nd ? "alert" : undefined}>
                      <div className={k("text-[12.5px] font-black text-[#FF7A7E]", "sn-err-t text-[13px] font-bold")}>{t("falhou")}</div>
                      <div className={k("mt-1 text-[12px] leading-snug text-g-ink", "sn-p mt-1 text-[12.5px] leading-snug")}>{t(falha)}</div>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {falha === "m_mudou" && <button onClick={() => window.location.reload()} className={k("text-[12px] font-bold text-g-word underline", "sn-ink min-h-[32px] text-[12.5px] font-bold underline")}>{t("reload")}</button>}
                        <a href={WA} target="_blank" rel="noopener noreferrer" className={k("inline-block text-[12px] font-bold text-g-green underline", "sn-ok inline-flex min-h-[32px] items-center text-[12.5px] font-bold underline")}>💬 {t("help")}</a>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={submit} disabled={state === "signing"} className={k("btn-bright min-h-[48px] text-sm disabled:opacity-60", "sn-btn")}>
                      {state === "signing" ? t("signing") : `✍️ ${t("sign")}`}
                    </button>
                    <button onClick={() => window.print()} className={k("btn-ghost text-sm", "sn-btn-ghost")}>{t("print")}</button>
                  </div>
                  <p className={k("mt-3 text-[11px] text-g-muted", "sn-muted mt-3.5 text-[12px]")}>{t("physical")}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── [D] BARRA FIXA — só enquanto o bloco de aceite NÃO está na tela ─────────────────────
          Num documento de 13 cláusulas o botão de assinar ficava a uma rolagem inteira de
          distância. Aqui ele acompanha; e ao chegar no bloco de verdade, some. */}
      {doc && b && !assinado && !perto && !esperandoPrestador && (
        <div className={k("fixed inset-x-0 bottom-0 z-40 border-t border-g-line bg-g-deep/95 px-4 py-3 backdrop-blur print:hidden", "sn-bar fixed inset-x-0 bottom-0 z-40 px-4 py-3 print:hidden")}>
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className={k("truncate text-[11.5px] text-g-muted", "sn-muted truncate text-[12px]")}>{b.title || doc.title}</div>
              {valor && <div className={k("text-[17px] font-black leading-none text-g-word", "sn-ink text-[17px] font-extrabold leading-none")}>{valor}</div>}
            </div>
            <button onClick={() => document.getElementById("bloco-assinar")?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className={k("btn-bright min-h-[48px] shrink-0 text-sm", "sn-btn shrink-0")}>✍️ {t("sign")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
