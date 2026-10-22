// functions/lib/comentarios.js — COMENTÁRIO → DM (a lógica pura, sem rede e sem banco).
//
// Alguém comenta "PREÇO" no reel e recebe o preço no direct um segundo depois. É isso.
// Este arquivo decide DUAS coisas, e nada mais: (1) esse comentário casa com alguma campanha
// deste cliente? (2) essa pessoa PODE receber DM agora, ou já recebeu demais?
//
// POR QUE SEPARADO DO WEBHOOK: `meta-webhook.js` é o portão (assinatura, tenant, dedup, 200
// rápido). Regra de negócio lá dentro só se prova com um webhook real da Meta chegando — o que
// significa não provar nunca. Aqui é função pura: entra texto, sai decisão, e o teste roda em
// milissegundos sem tocar em nada. Mesma razão do `slotResolver.js` existir fora do agendamento.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// A ARMADILHA DO PORTUGUÊS (a razão principal de `normalizar` existir)
// A palavra-chave que o dono digita é "PREÇO". O que chega no comentário, na vida real:
//   "preço" · "preco" · "PREÇO?" · "Preço!!" · "preçoo" · "qual o preço disso"
// Comparar string com string erra em CINCO desses seis. Em inglês esse problema quase não
// aparece, e é por isso que a implementação de referência (OpenReply) não trata acento nenhum:
// ela nunca precisou. Aqui precisa — o mercado é PT/ES.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Deixa o texto comparável: minúsculo, SEM acento, pontuação virando espaço.
 * "PREÇO?!" e "preco" viram os dois "preco". Emoji some junto com a pontuação — de propósito:
 * ninguém cadastra emoji como palavra-chave, e "🔥PREÇO🔥" é um comentário comuníssimo.
 */
export function normalizar(t) {
  return String(t == null ? "" : t)
    .normalize("NFD")               // separa a letra do acento…
    .replace(/[\u0300-\u036f]/g, "") // …e joga o acento fora: "ç"→"c", "ã"→"a"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")     // pontuação, emoji e quebra de linha viram UM espaço
    .trim();
}

/**
 * O comentário casa com esta palavra-chave?
 *
 * DOIS MODOS, e a diferença entre eles é dinheiro:
 *   "palavra" (padrão) — casa a palavra INTEIRA. "preco" casa em "qual o preco disso",
 *      mas NÃO casa dentro de "precoce". É o certo pra 95% dos casos.
 *   "contem" — casa como pedaço. Serve pra chave colada ou com plural/variação
 *      ("promo" pegando "promoção", hashtag "#promo10"). Pega mais gente e erra mais.
 *
 * POR QUE O PADRÃO É O MAIS ESTRITO: um DM errado não é neutro. Quem comentou "que preçoce
 * esse lançamento" e recebe uma tabela de preços marca como spam — e denúncia de spam no
 * direct é exatamente o que a Meta usa pra limitar a conta DO CLIENTE. O custo de deixar um
 * lead passar é um lead; o custo de spammar é a conta.
 */
export function casaPalavra(textoNorm, chaveNorm, modo = "palavra") {
  if (!textoNorm || !chaveNorm) return false;
  if (modo === "contem") return textoNorm.includes(chaveNorm);
  // Palavra inteira: cercada por limite de string ou por espaço. O texto JÁ passou por
  // normalizar(), então só existe [a-z0-9] e espaço — não preciso de regex de pontuação.
  return textoNorm === chaveNorm
    || textoNorm.startsWith(chaveNorm + " ")
    || textoNorm.endsWith(" " + chaveNorm)
    || textoNorm.includes(" " + chaveNorm + " ");
}

/**
 * Este comentário pertence a esta campanha? (post certo + alguma palavra-chave casando)
 * Devolve a palavra que casou (string) ou "" — a palavra volta pro log, porque "não mandou"
 * sem dizer QUAL palavra faltou é um diagnóstico que não diagnostica nada.
 */
export function campanhaCasa(campanha, evento) {
  if (!campanha || campanha.active === false) return "";
  // Post: `media_id` vazio/nulo = a campanha vale pra TODOS os posts da conta.
  // ANÚNCIO IMPULSIONADO: um comentário num post promovido chega com o media_id DO ANÚNCIO,
  // enquanto a campanha foi criada em cima do post orgânico. Sem aceitar o `original_media_id`
  // toda campanha morre silenciosamente no dia em que o dono promove o post — que é justamente
  // o dia em que chega mais comentário. (Lição herdada do OpenReply; a Guileo roda anúncios,
  // então aqui isso não é caso de borda, é o caso principal.)
  const alvo = String(campanha.media_id || "").trim();
  if (alvo) {
    const veio = [evento.mediaId, evento.originalMediaId].filter(Boolean).map(String);
    if (!veio.includes(alvo)) return "";
  }
  const texto = normalizar(evento.texto);
  if (!texto) return "";
  const modo = campanha.match_mode === "contem" ? "contem" : "palavra";
  for (const bruta of Array.isArray(campanha.keywords) ? campanha.keywords : []) {
    const chave = normalizar(bruta);
    if (chave && casaPalavra(texto, chave, modo)) return String(bruta);
  }
  return "";
}

/**
 * Escolhe UMA campanha entre as ativas do cliente. Uma pessoa recebe UM DM por comentário —
 * duas campanhas casando não podem virar dois direct na mesma pessoa no mesmo segundo.
 *
 * DESEMPATE: campanha amarrada a um post ESPECÍFICO ganha da campanha "todos os posts".
 * O dono que criou uma campanha só pro lançamento espera que ELA responda naquele post, não
 * a genérica que ele configurou há três meses e esqueceu.
 */
export function escolherCampanha(campanhas, evento) {
  const casadas = [];
  for (const c of Array.isArray(campanhas) ? campanhas : []) {
    const palavra = campanhaCasa(c, evento);
    if (palavra) casadas.push({ campanha: c, palavra });
  }
  if (!casadas.length) return null;
  casadas.sort((a, b) => {
    const ea = a.campanha.media_id ? 0 : 1; // específica primeiro
    const eb = b.campanha.media_id ? 0 : 1;
    if (ea !== eb) return ea - eb;
    // Empate real: a mais NOVA ganha — é a que o dono mexeu por último.
    return String(b.campanha.created_at || "").localeCompare(String(a.campanha.created_at || ""));
  });
  return casadas[0];
}

/**
 * FREIO ANTI-SPAM POR PESSOA.
 *
 * O dedup por id de comentário (que o webhook já faz) só impede a Meta de reentregar o MESMO
 * comentário. Não impede nada do que acontece de verdade: a mesma pessoa comenta "PREÇO" em
 * quatro fotos seguidas, ou comenta três vezes na mesma foto porque achou que não foi. São
 * comentários DIFERENTES, com ids diferentes — e viram quatro direct idênticos.
 *
 * Quatro direct iguais em dois minutos é a definição operacional de spam pra Meta, e quem paga
 * é a conta DO CLIENTE. Por isso o freio é por PESSOA, não por comentário.
 *
 * @param {number} enviadosNaJanela  quantos DM essa pessoa já recebeu desta conta na janela
 * @param {number} minutosDesdeUltimo  minutos desde o último DM (Infinity se nunca recebeu)
 */
export function podeMandar(enviadosNaJanela, minutosDesdeUltimo, regra = REGRA_PADRAO) {
  if (minutosDesdeUltimo < regra.esperaMinutos) return false;
  if (enviadosNaJanela >= regra.maxPorJanela) return false;
  return true;
}

// Os números. Deliberadamente frouxos o bastante pra não perder quem PEDIU de novo,
// e apertados o bastante pra nunca virar rajada. Um lugar só pra ajustar.
export const REGRA_PADRAO = {
  esperaMinutos: 10,   // o mesmo pedido repetido em <10min é a mesma intenção, não um lead novo
  maxPorJanela: 3,     // 3 DM por pessoa por dia por conta — acima disso é rajada, não interesse
  janelaHoras: 24,
};

// Teto da Meta: 750 private replies por hora POR CONTA. Passar disso não é multa, é bloqueio
// da conta do cliente. A fila segura o excedente em vez de derrubar (o webhook aplica).
export const TETO_HORA_META = 750;

/**
 * Monta o texto final do DM. `{nome}` vira o @ de quem comentou — personalização que a
 * implementação de referência chama de {username} e que dobra resposta na prática.
 * O link entra no fim, numa linha própria: link colado no texto é clicado bem menos.
 */
export function montarDm(modelo, { usuario, link }) {
  let t = String(modelo || "").replace(/\{nome\}|\{username\}/gi, usuario ? `@${usuario}` : "");
  t = t.replace(/[ \t]{2,}/g, " ").trim();
  if (link) t += `\n\n${link}`;
  return t.slice(0, 900); // mesmo teto que sendMetaReply já usa pro resto do canal
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// IDIOMA — responder na língua de quem escreveu, sem gastar um centavo.
//
// A Gui ATENDE o telefone em 16 idiomas (LANGS_SPOKEN, em provision.js). Um comentário em
// espanhol respondido em português é a mesma falha que um lead coreano recebendo ligação em
// inglês: a plataforma sabe o idioma e mesmo assim não usa.
//
// NÃO USA IA. Detectar idioma com modelo custaria por comentário, somaria latência ao DM (que
// vale por ser instantâneo) e erraria justamente nos textos curtos — que são a maioria aqui
// ("preço?", "how much"). As três camadas abaixo são determinísticas e testáveis:
//
//   1. ESCRITA  — 中文 só existe em chinês, 한국어 só em coreano. Sem ambiguidade nenhuma.
//   2. PALAVRA  — a chave que CASOU já carrega o idioma. "quanto custa" é português e ponto.
//                 A detecção sai de graça do trabalho que campanhaCasa() já fez.
//   3. PADRÃO   — empate ou desconhecido cai no idioma da campanha. NUNCA no chute.
//
// 🚨 A ARMADILHA: estas funções leem o texto CRU, nunca o de normalizar(). O normalizar()
// existe pra COMPARAR e por isso arranca acento e tudo que não é [a-z0-9] — ou seja, apaga
// exatamente o sinal de idioma. "Ελληνικά" e "日本語" viram string vazia; "não" vira "nao" e
// perde o til que o distinguia do espanhol. Detectar depois de normalizar seria detectar no
// escuro e ainda achar que enxergou.
// ═════════════════════════════════════════════════════════════════════════════════════════════

// Ordem IMPORTA. Japonês escreve com kana E com os mesmos ideogramas do chinês: testar Han
// primeiro classificaria todo japonês como chinês. Kana e Hangul são exclusivos, vêm antes.
const ESCRITAS = [
  [/[぀-ヿ]/, "ja"], // hiragana + katakana — exclusivos do japonês
  [/[가-힯]/, "ko"], // hangul
  [/[一-鿿]/, "zh"], // han (só sobra chinês, porque o japonês já saiu acima)
  [/[؀-ۿ]/, "ar"],
  [/[ऀ-ॿ]/, "hi"], // devanágari
  [/[฀-๿]/, ""],   // tailandês: reconheço a escrita e assumo NÃO SABER (não está em LANGS_SPOKEN)
];

// Letras que só existem num idioma de alfabeto latino. Conservador de propósito: "ç" está fora
// porque é português E francês, e um sinal que aponta pra dois não é sinal — é palpite.
const LATINAS = [
  [/[ăâđêôơư]|ệ|ạ|ủ|ớ/i, "vi"],
  [/[łżźćńśęą]/i, "pl"],
  [/[ñ]|¿|¡/i, "es"],
  [/[ãõ]/i, "pt"],
  [/[ß]|ä.*ö|öffn/i, "de"],
];

/**
 * Idioma pela ESCRITA do texto cru. Devolve o código, ou "" quando não dá pra afirmar.
 * "" é uma resposta legítima e a mais comum — a maior parte do mundo comenta em alfabeto
 * latino, onde a escrita não decide nada. Quem decide aí é a camada 2.
 */
export function idiomaPorEscrita(textoCru) {
  const t = String(textoCru == null ? "" : textoCru);
  if (!t) return "";
  for (const [re, code] of ESCRITAS) if (re.test(t)) return code;
  // Cirílico: ucraniano tem letras que o russo não tem. Checar as exclusivas ANTES de assumir
  // russo — senão todo ucraniano vira russo, que além de errado é ofensivo.
  if (/[іїєґ]/i.test(t)) return "uk";
  if (/[Ѐ-ӿ]/.test(t)) return "ru";
  for (const [re, code] of LATINAS) if (re.test(t)) return code;
  return "";
}

/**
 * LÉXICO DE INTENÇÃO — a palavra-chave que casou, mapeada pro idioma dela.
 * Só entra palavra que pertence a UM idioma. As que servem a vários vivem em AMBIGUAS, e o
 * ponto de listá-las é a tela poder AVISAR o dono ("'valor' bate em PT e ES") em vez de ele
 * descobrir por um DM no idioma errado.
 * Chaves já normalizadas (sem acento, minúsculas) — a busca normaliza antes de olhar aqui.
 */
export const LEXICO_IDIOMA = {
  // inglês
  "price": "en", "how much": "en", "cost": "en", "pricing": "en", "interested": "en", "want": "en",
  // português
  "preco": "pt", "quanto custa": "pt", "quero": "pt", "orcamento": "pt", "quanto e": "pt",
  // espanhol
  "precio": "es", "cuanto cuesta": "es", "quiero": "es", "presupuesto": "es", "cuanto vale": "es",
  // os demais entram junto com a campanha que precisar deles
  "prix": "fr", "combien": "fr",
  "prezzo": "it", "quanto costa": "it",
  "preis": "de", "wieviel": "de",
  "cena": "pl",
  "цена": "ru", "скольк": "ru",
  "가격": "ko", "얼마": "ko",
  "价格": "zh", "多少钱": "zh",
  "値段": "ja", "いくら": "ja",
  "कीमत": "hi", "दाम": "hi",
  "سعر": "ar", "كم": "ar",
  "gia": "vi", "bao nhieu": "vi",
  "magkano": "tl", "presyo": "tl",
  "ціна": "uk", "скільк": "uk",
};

/** Palavras que servem a mais de um idioma — nunca decidem sozinhas. */
export const AMBIGUAS = new Set(["info", "valor", "ok", "promo", "vip", "link", "menu"]);

/** A palavra é ambígua entre idiomas? A tela usa isto pra avisar antes de o DM sair errado. */
export function palavraAmbigua(palavra) {
  return AMBIGUAS.has(normalizar(palavra));
}

/**
 * DECIDE O IDIOMA DA RESPOSTA. Três camadas, nesta ordem, e devolve TAMBÉM por onde decidiu.
 *
 * O `via` não é enfeite: quando um DM sair no idioma errado, a diferença entre "a escrita disse
 * coreano" e "caiu no padrão porque a palavra era ambígua" é a diferença entre consertar em um
 * minuto e passar a tarde adivinhando. Motivo na tela, não no meu chute — a mesma regra que
 * vale pro estado dos canais.
 *
 * @param {string}   texto      o comentário CRU (com acento, com ideograma — ver a armadilha acima)
 * @param {string}   palavra    a palavra-chave que casou (vinda de campanhaCasa)
 * @param {string[]} permitidos idiomas que ESTE cliente respondeu ter texto pronto
 * @param {string}   padrao     idioma da campanha, o último recurso
 */
export function escolherIdioma({ texto = "", palavra = "", permitidos = [], padrao = "en" } = {}) {
  const ok = (c) => !!c && (!permitidos.length || permitidos.includes(c));

  const escrita = idiomaPorEscrita(texto);
  if (ok(escrita)) return { code: escrita, via: "escrita" };

  const chave = normalizar(palavra);
  // AMBIGUAS vence o léxico de propósito: se a palavra serve a vários idiomas, ela não decide
  // nem que esteja no mapa. Melhor cair no padrão do dono do que sortear entre PT e ES.
  if (chave && !AMBIGUAS.has(chave)) {
    // Sem normalizar do lado do mapa: chaves não-latinas (가격, 价格) morreriam no normalizar().
    const lex = LEXICO_IDIOMA[chave] || LEXICO_IDIOMA[String(palavra).trim().toLowerCase()];
    if (ok(lex)) return { code: lex, via: "palavra" };
  }

  // A escrita/palavra pode ter apontado um idioma que o cliente NÃO tem texto — aí é padrão,
  // e o `via` diz isso, pra ninguém achar que a detecção falhou quando faltou é tradução.
  const faltou = (escrita || LEXICO_IDIOMA[chave] || "") || "";
  return { code: padrao, via: faltou ? `padrao_sem_texto_${faltou}` : "padrao" };
}

/**
 * O texto do DM no idioma escolhido, com queda honesta.
 * `dm_i18n` é o mapa novo ({en, pt, es, …}); `dm_text` é o campo antigo, de uma língua só.
 * Campanha antiga (sem dm_i18n) continua funcionando exatamente como funcionava — nenhuma
 * campanha no ar pode parar de responder porque eu adicionei idioma.
 */
export function textoDoIdioma(campanha, code, padrao = "") {
  return escolherTexto(campanha && campanha.dm_i18n, code, padrao, campanha && campanha.dm_text);
}

/**
 * O mesmo, genérico — usado também pela RESPOSTA PÚBLICA, que aparece pra TODO MUNDO embaixo do
 * comentário. Sair em inglês debaixo de um comentário em espanhol é o mais visível dos dois erros:
 * o DM errado só quem recebeu vê; a resposta pública o feed inteiro vê.
 *
 * A ordem da queda é: idioma pedido → idioma padrão → campo antigo de uma língua só. A última
 * queda é o que mantém campanha velha respondendo igual — nunca "" só porque o mapa está vazio.
 */
export function escolherTexto(mapa, code, padrao = "", queda = "") {
  const m = (mapa && typeof mapa === "object" && !Array.isArray(mapa)) ? mapa : null;
  const pega = (c) => (m && typeof m[c] === "string" && m[c].trim()) ? m[c].trim() : "";
  return pega(code) || pega(padrao) || String(queda || "").trim();
}

/**
 * Carimba o idioma no link. É o que faz a landing abrir traduzida (i18n.jsx lê ?lang=), o lead
 * nascer com `lang` e a Gui LIGAR naquele idioma (call.js) — o corredor já existe inteiro; o
 * comentário só precisava dizer por onde a pessoa entrou.
 */
export function linkComIdioma(link, code) {
  const u = String(link || "").trim();
  if (!u || !code) return u;
  if (/[?&]lang=/.test(u)) return u;              // o dono já escolheu na mão: não sobrescrevo
  const [semHash, hash] = u.split("#");           // ?lang= tem que vir ANTES do #contact
  const sep = semHash.includes("?") ? "&" : "?";
  return `${semHash}${sep}lang=${encodeURIComponent(code)}${hash ? "#" + hash : ""}`;
}

// ── O CARIMBO DO DIRECT NO LINK (2026-10-04) ───────────────────────────────────────────────────
// O caminho comentário → DM → site → lead EXISTIA, mas o lead chegava órfão: os links usavam
// `?ref=ig-comentario`, e o site só captura utm_*/gclid/fbclid (src/lib/analytics.js). Com o
// carimbo, o lead nasce em lead_attribution com medium="direct" e campaign=<id da campanha> — e o
// painel responde "esta campanha trouxe N leads" com um COUNT, não com palpite.
// Regras: nunca sobrescreve utm que o dono pôs à mão; preserva o #âncora; leva o idioma junto.
// ⚠️ Primeiro toque vence (90 dias): quem já veio de um anúncio antes continua creditado ao anúncio.
// Isso é a regra da casa (atribuicao.js), não um defeito — o Direct não rouba crédito de ninguém.
export function linkDoDirect(link, code, campanhaId) {
  const comIdioma = linkComIdioma(link, code);
  if (!comIdioma) return comIdioma;
  if (/[?&]utm_(source|medium|campaign)=/i.test(comIdioma)) return comIdioma;
  const [semHash, hash] = comIdioma.split("#");
  const sep = semHash.includes("?") ? "&" : "?";
  const utm = `utm_source=instagram&utm_medium=direct${campanhaId ? `&utm_campaign=${encodeURIComponent(String(campanhaId))}` : ""}`;
  return `${semHash}${sep}${utm}${hash ? "#" + hash : ""}`;
}

// ── DE ONDE ESTA CONVERSA VEIO (contexto do SERVIDOR para a Gui) ───────────────────────────────
// Quem recebeu o DM de um comentário e responde no Direct está no meio de uma conversa que a Gui
// começou. Sem isto ela recebe "e pra 2 pessoas?" sem saber 2 de quê, e cumprimenta como estranha
// alguém que acabou de falar com ela. A frase vem do NOSSO banco (palavra e nome da campanha que o
// dono configurou), nunca do texto da cliente — por isso pode entrar no prompt de sistema.
// `ctx` = retorno de direct_contexto_pessoa ({quando, palavra, campanha}) ou null.
export function origemDaConversa(ctx, agoraMs = Date.now()) {
  if (!ctx || !ctx.palavra) return "";
  const limpo = (v, n) => String(v || "").replace(/["“”\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
  const palavra = limpo(ctx.palavra, 40);
  const campanha = limpo(ctx.campanha, 80);
  const ms = Math.max(0, agoraMs - (Date.parse(ctx.quando) || agoraMs));
  const min = Math.round(ms / 60000);
  const tempo = min < 60 ? `${Math.max(1, min)} min` : min < 2880 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} days`;
  return `HOW THIS CONVERSATION STARTED (verified by the server, not said by the customer): this person commented "${palavra}" on one of this business's Instagram posts${campanha ? ` (campaign "${campanha}")` : ""} about ${tempo} ago and already received the automatic Direct reply to that comment. They are now answering in the Direct. Continue that same conversation naturally — do not greet them as a stranger and do not ask from scratch what they want; they came for what "${palavra}" is about.`;
}
