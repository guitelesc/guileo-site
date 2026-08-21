import { useMemo, useState } from "react";
import { PITCH_CARDS, PITCH_NICHES } from "../data/cartasDePitch.js";
import { upsellLinesFor } from "../data/upsellPlaybook.js";
import { guileoDoNicho, nichoMapeado } from "../data/guileoPorVertical.js";
import { PRODUCTS } from "../data/productSystem.js";

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// VERTICAL — o briefing por setor, lido ANTES de entrar na reunião.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE: o hub vai atender 1.000+ vendedores, muitos não-técnicos, na rua, no celular.
// O vendedor entra num salão (ou clínica, ou restaurante) e precisa saber EXATAMENTE o que dizer
// para AQUELE tipo de negócio. O material já existia (PITCH_CARDS, 16 nichos, pt/en/es); o que
// faltava era a tela que o entrega na ORDEM DA CONVERSA, com copiar em cada bloco.
//
// NADA AQUI É CONTEÚDO NOVO. Toda frase vem de src/data/cartasDePitch.js. Se uma frase está errada,
// conserta-se lá — esta tela não tem cópia própria além da moldura (títulos e botões).
//
// ⚠️ AS DUAS LEIS DESTA SUPERFÍCIE
//
// 1. IDIOMA NUNCA SE MISTURA, E RESERVA É SEMPRE `en`.
//    PITCH_CARDS e UPSELL_PLAYBOOK têm pt/en/es e NÃO têm `hi`. Toda leitura de dicionário passa
//    por `L()`, com reserva explícita em inglês — chave ausente em JS devolve `undefined` e o
//    React desenha NADA (neste repo isso já deixou um botão inteiro sem rótulo por semanas).
//    Quando o conteúdo sai em inglês porque o idioma pedido não existe, a tela DIZ isso. Meia
//    tradução silenciosa é pior que inglês declarado.
//
// 2. AS FALAS DE UPSELL NÃO SÃO JOGADA DE VENDEDOR.
//    UPSELL_PLAYBOOK é o que a AGENTE fala com os CLIENTES DO CLIENTE ("pediu pizza grande →
//    oferece borda recheada"). Entram aqui como PROVA DE CAPACIDADE — "a agente não só agenda,
//    ela aumenta o ticket dele" — e por isso o bloco tem rótulo próprio e um aviso. Rotular
//    errado faria o vendedor recitar essas linhas na reunião: constrangedor e falso.
//    Setor sem correspondência → o bloco NÃO desenha. Bloco sem dado não desenha (lei da casa),
//    e jamais se inventa uma fala para um setor que não tem.

const U = {
  pt: {
    gpvTitulo: "Os 3 Guileos para este negócio", gpvSub: "Na ordem da conversa: o primeiro de cada perna é o que resolve a dor que ele sente antes de qualquer outra.", gpvGenerico: "lista geral — este setor ainda não tem mapa próprio",
    h: "Vertical", sub: "O briefing do setor antes de entrar na reunião. Escolha o tipo de negócio e leve as frases prontas.",
    escolha: "Qual é o tipo de negócio?",
    trocar: "Trocar de setor",
    ordem: "Na ordem da conversa",
    copiar: "📋 Copiar", copiado: "Copiado ✓", copiaFalhou: "⚠️ Não copiou",
    b_opener: "1 · Abertura", b_opener_d: "A primeira frase, a que abre a porta.",
    b_pain: "2 · A dor", b_pain_d: "O problema que ele vive e não nomeia.",
    b_leak: "3 · O vazamento", b_leak_d: "Quanto isso custa por mês, em dinheiro.",
    b_disc: "4 · As perguntas", b_disc_d: "Deixe ele dizer o número. Não fale por ele.",
    b_sol: "5 · A solução", b_sol_d: "O que a Guileo faz — em uma frase.",
    b_gain: "6 · O ganho", b_gain_d: "O que muda no negócio dele.",
    b_edge: "7 · O diferencial", b_edge_d: "Por que com você e não com o concorrente.",
    b_obj: "8 · A objeção", b_obj_d: "O que ele vai dizer — e a resposta.",
    obj_q: "Ele diz:", obj_a: "Você responde:",
    up_h: "O que a agente faz pelo faturamento dele",
    up_sub: "Prova de capacidade: a agente não só agenda — ela aumenta o ticket. Estas são falas que ELA usa com os clientes DELE, no meio do atendimento. Não são frases pra você recitar na reunião.",
    resumo: "Resumo pro WhatsApp", resumo_d: "Abertura + dor + gancho, num toque.",
    resumo_copiar: "📋 Copiar resumo",
    semTrad: "⚠️ Este conteúdo ainda não tem tradução para o seu idioma — está em inglês. Nada foi traduzido pela metade.",
  },
  en: {
    gpvTitulo: "The 3 Guileos for this business", gpvSub: "In conversation order: the first of each leg is what fixes the pain they feel before any other.", gpvGenerico: "general list — this sector has no map of its own yet",
    h: "Vertical", sub: "The sector briefing before you walk into the meeting. Pick the business type and take the lines with you.",
    escolha: "What kind of business is it?",
    trocar: "Change sector",
    ordem: "In conversation order",
    copiar: "📋 Copy", copiado: "Copied ✓", copiaFalhou: "⚠️ Not copied",
    b_opener: "1 · Opener", b_opener_d: "The first line — the one that opens the door.",
    b_pain: "2 · The pain", b_pain_d: "The problem he lives with and never names.",
    b_leak: "3 · The leak", b_leak_d: "What it costs per month, in money.",
    b_disc: "4 · The questions", b_disc_d: "Let him say the number. Don't say it for him.",
    b_sol: "5 · The solution", b_sol_d: "What Guileo does — in one sentence.",
    b_gain: "6 · The gain", b_gain_d: "What changes in his business.",
    b_edge: "7 · The edge", b_edge_d: "Why with you and not with the competitor.",
    b_obj: "8 · The objection", b_obj_d: "What he will say — and the answer.",
    obj_q: "He says:", obj_a: "You answer:",
    up_h: "What the agent does for his revenue",
    up_sub: "Proof of capability: the agent doesn't just book — it raises the ticket. These are lines SHE uses with HIS customers, mid-call. They are not lines for you to recite in the meeting.",
    resumo: "WhatsApp summary", resumo_d: "Opener + pain + hook, in one tap.",
    resumo_copiar: "📋 Copy summary",
    semTrad: "⚠️ This content has no translation for your language yet — it is shown in English. Nothing was half-translated.",
  },
  es: {
    gpvTitulo: "Los 3 Guileos para este negocio", gpvSub: "En orden de conversación: el primero de cada pierna resuelve el dolor que siente antes que cualquier otro.", gpvGenerico: "lista general — este sector aún no tiene mapa propio",
    h: "Vertical", sub: "El briefing del sector antes de entrar a la reunión. Elige el tipo de negocio y llévate las frases listas.",
    escolha: "¿Qué tipo de negocio es?",
    trocar: "Cambiar de sector",
    ordem: "En el orden de la conversación",
    copiar: "📋 Copiar", copiado: "Copiado ✓", copiaFalhou: "⚠️ No se copió",
    b_opener: "1 · Apertura", b_opener_d: "La primera frase, la que abre la puerta.",
    b_pain: "2 · El dolor", b_pain_d: "El problema que vive y no nombra.",
    b_leak: "3 · La fuga", b_leak_d: "Cuánto cuesta al mes, en dinero.",
    b_disc: "4 · Las preguntas", b_disc_d: "Deja que él diga el número. No lo digas por él.",
    b_sol: "5 · La solución", b_sol_d: "Lo que hace Guileo — en una frase.",
    b_gain: "6 · La ganancia", b_gain_d: "Lo que cambia en su negocio.",
    b_edge: "7 · La ventaja", b_edge_d: "Por qué contigo y no con el competidor.",
    b_obj: "8 · La objeción", b_obj_d: "Lo que va a decir — y la respuesta.",
    obj_q: "Él dice:", obj_a: "Tú respondes:",
    up_h: "Lo que la agente hace por su facturación",
    up_sub: "Prueba de capacidad: la agente no solo agenda — sube el ticket. Estas son frases que ELLA usa con los clientes DE ÉL, durante la llamada. No son frases para que tú las recites en la reunión.",
    resumo: "Resumen para WhatsApp", resumo_d: "Apertura + dolor + gancho, en un toque.",
    resumo_copiar: "📋 Copiar resumen",
    semTrad: "⚠️ Este contenido todavía no tiene traducción a tu idioma — se muestra en inglés. Nada quedó traducido a medias.",
  },
  hi: {
    gpvTitulo: "इस व्यवसाय के लिए 3 Guileo", gpvSub: "बातचीत के क्रम में: हर पैर का पहला वही है जो सबसे पहले महसूस होने वाला दर्द ठीक करता है।", gpvGenerico: "सामान्य सूची — इस क्षेत्र का अपना नक्शा अभी नहीं है",
    h: "Vertical", sub: "मीटिंग में जाने से पहले सेक्टर का ब्रीफिंग। बिज़नेस का प्रकार चुनें और तैयार वाक्य साथ ले जाएं।",
    escolha: "यह किस तरह का बिज़नेस है?",
    trocar: "सेक्टर बदलें",
    ordem: "बातचीत के क्रम में",
    copiar: "📋 कॉपी करें", copiado: "कॉपी ✓", copiaFalhou: "⚠️ कॉपी नहीं हुआ",
    b_opener: "1 · शुरुआत", b_opener_d: "पहला वाक्य — जो दरवाज़ा खोलता है।",
    b_pain: "2 · दर्द", b_pain_d: "वह समस्या जो वह जीता है पर बताता नहीं।",
    b_leak: "3 · रिसाव", b_leak_d: "यह हर महीने कितने पैसे का नुकसान है।",
    b_disc: "4 · सवाल", b_disc_d: "नंबर उसे कहने दें। उसकी जगह आप न कहें।",
    b_sol: "5 · समाधान", b_sol_d: "Guileo क्या करता है — एक वाक्य में।",
    b_gain: "6 · फ़ायदा", b_gain_d: "उसके बिज़नेस में क्या बदलता है।",
    b_edge: "7 · बढ़त", b_edge_d: "आपके साथ क्यों, प्रतियोगी के साथ क्यों नहीं।",
    b_obj: "8 · आपत्ति", b_obj_d: "वह क्या कहेगा — और उसका जवाब।",
    obj_q: "वह कहता है:", obj_a: "आप जवाब देते हैं:",
    up_h: "एजेंट उसकी कमाई के लिए क्या करती है",
    up_sub: "क्षमता का प्रमाण: एजेंट सिर्फ़ बुकिंग नहीं करती — वह टिकट बढ़ाती है। ये वे वाक्य हैं जो वह उसके ग्राहकों से कॉल के दौरान बोलती है। ये आपके मीटिंग में बोलने के वाक्य नहीं हैं।",
    resumo: "WhatsApp सारांश", resumo_d: "शुरुआत + दर्द + हुक, एक टैप में।",
    resumo_copiar: "📋 सारांश कॉपी करें",
    semTrad: "⚠️ इस सामग्री का आपकी भाषा में अनुवाद अभी नहीं है — यह अंग्रेज़ी में दिखाई जा रही है। कुछ भी आधा-अधूरा अनुवादित नहीं है।",
  },
};

// Os DADOS (PITCH_CARDS / UPSELL_PLAYBOOK) existem em 3 idiomas. `hi` não existe lá — cai em `en`
// e a tela avisa. A reserva é SEMPRE `en`, nunca `pt`: um vendedor hispano lendo português por
// engano é o mesmo defeito, só que mais difícil de perceber.
const DATA_LANGS = ["pt", "en", "es"];

// A ponte nicho → texto de setor que os helpers do upsellPlaybook casam. É roteamento, não
// conteúdo. Nicho ausente daqui = sem correspondência de propósito:
//   • universal / ads — não são setor, são cartas transversais;
//   • vet — o playbook só tem `clinic`, cujas falas são odontológicas (clareamento, limpeza);
//     servir isso a um veterinário seria inventar capacidade;
//   • cleaning — nenhuma chave do playbook casa com limpeza.
// Bloco sem dado não desenha.
const SETOR_DO_NICHO = {
  restaurant: "restaurant",
  dental: "dentist",
  clinic: "clinic",
  salon: "salon",
  homeservices: "handyman",
  realestate: "real estate",
  law: "law",
  autorepair: "auto repair",
  fitness: "fitness",
  spa: "spa",
  retail: "retail",
  cafe: "cafe",
};

// Sentinela que não casa com nenhuma palavra do playbook — serve pra descobrir, USANDO O PRÓPRIO
// HELPER (sem reimplementar o casamento), qual é a lista genérica de fallback. Se as falas do
// setor forem idênticas à genérica, é porque NÃO houve correspondência.
const SEM_SETOR = "zzzz";

const BLOCO = "rounded-xl border border-white/10 bg-white/[0.03] p-4 min-w-0";
const BTN_COPIAR = "shrink-0 min-h-[44px] rounded-lg border border-white/15 bg-white/[0.06] px-3 text-[12.5px] font-bold text-g-word hover:border-g-green/40";

// Definido no ESCOPO DO MÓDULO de propósito. Componente declarado DENTRO do pai vira um tipo novo
// a cada render — o React desmonta e remonta a subárvore inteira a cada toque em "copiar", o que
// derruba foco e rolagem no celular. Fora do pai, o React só re-renderiza.
// Um bloco só desenha se tiver texto. Bloco sem dado não desenha.
function Bloco({ chave, titulo, dica, texto, linhas, copiado, onCopiar, rotCopiar, rotCopiado, rotFalhou }) {
  const itens = Array.isArray(linhas) ? linhas : [];
  if (!texto && itens.length === 0) return null;
  const paraCopiar = texto || itens.map((l) => `• ${l}`).join("\n");
  return (
    <div className={BLOCO}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-g-green">{titulo}</div>
          <div className="mt-0.5 text-[11px] text-g-muted">{dica}</div>
        </div>
        <button type="button" onClick={() => onCopiar(paraCopiar, chave)}
          className={`${BTN_COPIAR} ${copiado === `err:${chave}` ? "border-g-gold/50 text-g-gold" : ""}`}>
          {copiado === chave ? rotCopiado : copiado === `err:${chave}` ? rotFalhou : rotCopiar}
        </button>
      </div>
      {texto && <p className="mt-2 text-[13.5px] leading-relaxed text-g-word break-words">{texto}</p>}
      {itens.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {itens.map((l, i) => (
            <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-g-word break-words">
              <span className="shrink-0 text-g-green">•</span><span className="min-w-0">{l}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SellerVertical({ lang = "pt" }) {
  const t = U[lang] || U.pt;
  const dLang = DATA_LANGS.includes(lang) ? lang : "en";
  const traduzido = DATA_LANGS.includes(lang);

  const [nicho, setNicho] = useState("");
  const [copiado, setCopiado] = useState("");

  // "Copiado ✓" só aparece se o texto FOI copiado. `navigator.clipboard.writeText` REJEITA quando
  // a permissão é negada, quando a página não está em contexto seguro ou quando a aba não está em
  // foco — e um `writeText()` solto vira rejeição não tratada enquanto o botão mente que copiou.
  // O vendedor cola no WhatsApp e vem a frase anterior. Sucesso sem comprovante é promessa sem
  // lastro: aqui a etiqueta só muda depois do await, e a falha aparece na tela.
  const copiar = async (texto, chave) => {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
    } catch {
      setCopiado(`err:${chave}`);
    }
    setTimeout(() => setCopiado((c) => (c === chave || c === `err:${chave}` ? "" : c)), 1800);
  };

  // Leitura de dicionário com reserva EXPLÍCITA. Nunca devolve undefined.
  const L = (dic) => {
    if (!dic || typeof dic !== "object") return "";
    return dic[dLang] || dic.en || "";
  };
  const Lista = (arr) => (Array.isArray(arr) ? arr.map(L).filter(Boolean) : []);

  const card = nicho ? PITCH_CARDS[nicho] : null;
  const nicheInfo = PITCH_NICHES.find((n) => n.id === nicho) || null;

  const upsell = useMemo(() => {
    const setor = SETOR_DO_NICHO[nicho];
    if (!setor) return [];
    const linhas = upsellLinesFor(setor, dLang) || [];
    const generica = upsellLinesFor(SEM_SETOR, dLang) || [];
    // Sem correspondência, o helper devolve a lista genérica — que é do AGENTE, não deste setor.
    if (linhas.length === 0 || JSON.stringify(linhas) === JSON.stringify(generica)) return [];
    return linhas;
  }, [nicho, dLang]);

  const opener = L(card?.opener);
  const pain = L(card?.pain);
  const leak = L(card?.leak);
  const discovery = Lista(card?.discovery);
  const solution = L(card?.solution);
  const gain = Lista(card?.gain);
  const edge = L(card?.edge);
  const objQ = L(card?.objection?.q);
  const objA = L(card?.objection?.a);

  // Abertura + dor + gancho (o vazamento é o gancho: é o número que faz o dono responder).
  const resumo = [opener, pain, leak].filter(Boolean).join("\n\n");

  return (
    <div className="min-w-0">
      <div className="mb-4">
        <div className="text-lg font-extrabold text-g-word">🧭 {t.h}</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-g-muted">{t.sub}</p>
      </div>

      {/* ── SELETOR DE SETOR — grande e tocável, no topo, sempre visível ───────────────── */}
      <div className="card p-4 min-w-0 sm:p-5">
        <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{t.escolha}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {PITCH_NICHES.map((n) => {
            const ativo = n.id === nicho;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setNicho(ativo ? "" : n.id)}
                aria-pressed={ativo}
                className={`flex min-h-[56px] w-full min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                  ativo ? "border-g-green/60 bg-g-green/[0.12]" : "border-white/10 bg-white/[0.03] hover:border-white/25"
                }`}
              >
                <span className="shrink-0 text-[18px] leading-none">{n.emoji}</span>
                <span className={`min-w-0 text-[12px] font-bold leading-tight break-words ${ativo ? "text-g-word" : "text-g-muted"}`}>
                  {L(n.name)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── OS 3 GUILEOS PARA ESTE NEGÓCIO (2026-08-20) ────────────────────────────────────
          "O que cada Guileo faz para cada business". Nenhuma frase é escrita aqui: o nome e o
          resultado saem de `productSystem.js`, que já vive nos 4 idiomas e é a mesma fonte da
          landing e do cockpit do cliente. O que este bloco acrescenta é a ORDEM e a ESCOLHA —
          quais produtos importam para AQUELE dono, e com qual deles a conversa começa. */}
      {nicho && (
        <div className="mt-4 card p-4 min-w-0 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{t.gpvTitulo}</div>
            {!nichoMapeado(nicho) && (
              // ausência declarada: sem isto o vendedor leria a lista genérica como sob medida
              <span className="text-[10.5px]" style={{ color: "#8A8578" }}>{t.gpvGenerico}</span>
            )}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-g-muted">{t.gpvSub}</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {[["brain", "🧠", "Guileo Brain", "#FF8A33"], ["ad", "❤️", "Guileo AD", "#4C9AFF"], ["build", "🏗️", "Guileo Build", "#9AA0FF"]].map(([perna, ico, rot, cor]) => {
              const ids = guileoDoNicho(nicho)[perna] || [];
              return (
                <div key={perna} className="rounded-xl border bg-white/[0.03] p-3.5" style={{ borderColor: `${cor}33` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px]">{ico}</span>
                    <span className="text-[12px] font-black uppercase tracking-wider" style={{ color: cor }}>{rot}</span>
                  </div>
                  <ol className="mt-2.5 space-y-2.5">
                    {ids.map((id, i) => {
                      const p = PRODUCTS.find((x) => x.id === id);
                      if (!p) return null; // produto renomeado: some daqui em vez de virar linha vazia
                      return (
                        <li key={id} className="min-w-0">
                          <div className="flex items-start gap-1.5">
                            <span className="mt-[1px] shrink-0 text-[11px] font-black tabular-nums" style={{ color: cor, opacity: 0.7 }}>{i + 1}</span>
                            <div className="min-w-0">
                              <div className="text-[12.5px] font-bold leading-tight text-g-word">{p.icon} {L(p.name)}</div>
                              <div className="mt-0.5 text-[11.5px] leading-relaxed text-g-muted">{L(p.result)}</div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {card && (
        <>
          {/* Inglês declarado, nunca meia tradução silenciosa. */}
          {!traduzido && (
            <p className="mt-4 rounded-lg border border-g-gold/30 bg-g-gold/[0.08] px-3 py-2.5 text-[12px] leading-relaxed text-g-gold">
              {t.semTrad}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold text-g-word break-words">
                {nicheInfo?.emoji} {L(nicheInfo?.name)}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-g-muted">{t.ordem}</div>
            </div>
            <button type="button" onClick={() => setNicho("")} className="btn-ghost min-h-[44px] text-[12.5px]">
              {t.trocar}
            </button>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Bloco chave="opener" titulo={t.b_opener} dica={t.b_opener_d} texto={opener}  copiado={copiado} onCopiar={copiar} rotCopiar={t.copiar} rotCopiado={t.copiado} rotFalhou={t.copiaFalhou} />
            <Bloco chave="pain" titulo={t.b_pain} dica={t.b_pain_d} texto={pain}  copiado={copiado} onCopiar={copiar} rotCopiar={t.copiar} rotCopiado={t.copiado} rotFalhou={t.copiaFalhou} />
            <Bloco chave="leak" titulo={t.b_leak} dica={t.b_leak_d} texto={leak}  copiado={copiado} onCopiar={copiar} rotCopiar={t.copiar} rotCopiado={t.copiado} rotFalhou={t.copiaFalhou} />
            <Bloco chave="disc" titulo={t.b_disc} dica={t.b_disc_d} linhas={discovery}  copiado={copiado} onCopiar={copiar} rotCopiar={t.copiar} rotCopiado={t.copiado} rotFalhou={t.copiaFalhou} />
            <Bloco chave="sol" titulo={t.b_sol} dica={t.b_sol_d} texto={solution}  copiado={copiado} onCopiar={copiar} rotCopiar={t.copiar} rotCopiado={t.copiado} rotFalhou={t.copiaFalhou} />
            <Bloco chave="gain" titulo={t.b_gain} dica={t.b_gain_d} linhas={gain}  copiado={copiado} onCopiar={copiar} rotCopiar={t.copiar} rotCopiado={t.copiado} rotFalhou={t.copiaFalhou} />
            <Bloco chave="edge" titulo={t.b_edge} dica={t.b_edge_d} texto={edge}  copiado={copiado} onCopiar={copiar} rotCopiar={t.copiar} rotCopiado={t.copiado} rotFalhou={t.copiaFalhou} />

            {/* A objeção tem duas vozes — desenha só se as duas existirem. */}
            {objQ && objA && (
              <div className={BLOCO}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-g-green">{t.b_obj}</div>
                    <div className="mt-0.5 text-[11px] text-g-muted">{t.b_obj_d}</div>
                  </div>
                  <button type="button" onClick={() => copiar(`${objQ}\n\n${objA}`, "obj")}
                    className={`${BTN_COPIAR} ${copiado === "err:obj" ? "border-g-gold/50 text-g-gold" : ""}`}>
                    {copiado === "obj" ? t.copiado : copiado === "err:obj" ? t.copiaFalhou : t.copiar}
                  </button>
                </div>
                <p className="mt-2 text-[12.5px] italic leading-relaxed text-g-muted break-words">
                  <span className="not-italic font-bold">{t.obj_q} </span>{objQ}
                </p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-g-word break-words">
                  <span className="font-bold text-g-green">{t.obj_a} </span>{objA}
                </p>
              </div>
            )}
          </div>

          {/* ── PROVA DE CAPACIDADE (não é jogada de vendedor) ──────────────────────────
              Sem correspondência de setor, `upsell` é [] e este bloco simplesmente não existe. */}
          {upsell.length > 0 && (
            <div className="card mt-4 p-4 min-w-0 sm:p-5">
              <div className="text-[13px] font-extrabold text-g-word">💵 {t.up_h}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-g-muted">{t.up_sub}</p>
              <ul className="mt-3 space-y-2">
                {upsell.map((l, i) => (
                  <li key={i} className="flex gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[13px] leading-relaxed text-g-word break-words">
                    <span className="shrink-0 text-g-green">↗</span><span className="min-w-0">{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── RESUMO DE 1 TOQUE ───────────────────────────────────────────────────────── */}
          {resumo && (
            <div className="card mt-4 p-4 min-w-0 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold text-g-word">💬 {t.resumo}</div>
                  <p className="mt-0.5 text-[11.5px] text-g-muted">{t.resumo_d}</p>
                </div>
                <button type="button" onClick={() => copiar(resumo, "resumo")} className="btn-bright min-h-[44px] text-[13px]">
                  {copiado === "resumo" ? t.copiado : copiado === "err:resumo" ? t.copiaFalhou : t.resumo_copiar}
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 font-sans text-[12.5px] leading-relaxed text-g-word">
                {resumo}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
