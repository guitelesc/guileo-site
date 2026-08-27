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
