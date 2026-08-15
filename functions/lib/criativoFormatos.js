// functions/lib/criativoFormatos.js — OS LIMITES DE CADA CANAL, E A LEI DE NÃO INVENTAR.
//
// POR QUE ISTO É UM ARQUIVO SEPARADO (e sem nenhum import):
// o motor (criativoAds.js) fala com a IA e com o banco; estas funções só contam caracteres e
// procuram promessa inventada. Separadas, dá para TESTAR de verdade (criativoFormatos.test.mjs
// roda em node puro, sem chave de API e sem rede). Enquanto a regra do limite morava dentro do
// motor, o único jeito de conferir era gerar um anúncio de verdade e olhar — que é como um erro
// de 1 caractere chega ao cliente.
//
// ── A DESCOBERTA QUE MUDOU O DESENHO ─────────────────────────────────────────────────────────
// Quase todo campo de anúncio tem DOIS números, não um:
//   • ALVO  = onde a plataforma TRUNCA na tela ("Ver mais…"). É o que decide se o cliente lê a
//             frase inteira.
//   • DURO  = onde a API REJEITA a peça.
// O LinkedIn é o caso extremo: 150 (trunca) contra 3.000 (rejeita). Escrever 3.000 caracteres dá
// um anúncio tecnicamente válido e comercialmente morto — ninguém lê além da terceira linha.
// Por isso o motor apara pelo ALVO e usa o DURO só para avisar de rejeição.
//
// ── REGRA DE FONTE ───────────────────────────────────────────────────────────────────────────
// Todo número abaixo tem URL oficial e data de acesso. Onde não houve fonte oficial, está escrito
// "NÃO CONFIRMADO" e o valor escolhido é o CONSERVADOR (mais curto). Limite chutado não é detalhe:
// alto demais = peça reprovada ou texto cortado no meio da palavra; e quem descobre é o cliente.

const s = (v) => String(v == null ? "" : v);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// OS FORMATOS
// campos[].alvo = limite de exibição (o que aparamos) · .duro = limite de rejeição da API
// campos[].qtd  = quantas peças daquele campo (array) — ausente = campo único (string)
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const FORMATOS = {
  // ── GOOGLE SEARCH (RSA) — os limites são DUROS e iguais ao de exibição.
  // Fonte: https://support.google.com/google-ads/answer/7684791 (acessado 2026-08-11)
  // Idiomas de largura-dupla (zh/ja/ko) contam CADA caractere como 2 → na prática 15/45.
  google: {
    nome: "Google Search (responsive search ad)",
    fonte: "https://support.google.com/google-ads/answer/7684791 (acessado 2026-08-11)",
    regras: "No emoji. No exclamation marks in headlines. Title Case for headlines. Each headline must stand alone — Google shuffles them.",
    campos: [
      { chave: "headlines", rotulo: "Headline", alvo: 30, duro: 30, qtd: 3 },
      { chave: "descriptions", rotulo: "Description", alvo: 90, duro: 90, qtd: 2 },
    ],
  },

  // ── MICROSOFT / BING (responsive search ad) — números centrais idênticos ao Google.
  // Fonte: https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad?view=bingads-13 (acessado 2026-08-11)
  // DIFERENÇA REAL do Google: a Microsoft diz explicitamente que EMOJI conta como largura-dupla
  // (2 caracteres). O mesmo texto com emoji cabe no Google e estoura no Bing. Por isso a regra
  // do prompt aqui proíbe emoji — é o único jeito de a mesma peça servir aos dois.
  bing: {
    nome: "Microsoft Advertising (responsive search ad)",
    fonte: "https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad?view=bingads-13 (acessado 2026-08-11)",
    regras: "No emoji at all (Microsoft counts each emoji as TWO characters). No dynamic-text braces {}. Title Case for headlines.",
    campos: [
      { chave: "headlines", rotulo: "Headline", alvo: 30, duro: 30, qtd: 3 },
      { chave: "descriptions", rotulo: "Description", alvo: 90, duro: 90, qtd: 2 },
    ],
  },

  // ── META (Facebook/Instagram feed) — aqui o 125/40 NÃO é limite duro, é RECOMENDAÇÃO.
  // Recomendação de exibição (Instagram Feed): primary text 125, headline 40.
  //   Fonte: https://www.facebook.com/business/ads-guide/image/instagram-feed (acessado 2026-08-11)
  //   (No Facebook Feed a recomendação de headline é ainda menor — 27 — e o primary text vai de
  //    50 a 150: https://www.facebook.com/business/ads-guide/update/image/facebook-feed/link-clicks)
  // Máximo DURO (a API rejeita): bodies 1.024 · titles 255 · descriptions 255.
  //   Fonte: https://developers.facebook.com/docs/marketing-api/ad-creative/asset-feed-spec/options/ (acessado 2026-08-11)
  // ⚠️ "link description = 30" é o número que todo blog repete e que eu NÃO achei em página
  // oficial da Meta (as URLs de right column/stories retornam 404 hoje). Mantido 30 como ALVO
  // por ser CONSERVADOR — texto curto demais não é reprovado, texto longo demais é cortado.
  meta: {
    nome: "Meta (Facebook/Instagram) feed ad",
    fonte: "https://www.facebook.com/business/ads-guide/image/instagram-feed + https://developers.facebook.com/docs/marketing-api/ad-creative/asset-feed-spec/options/ (acessado 2026-08-11)",
    regras: "At most one emoji in the primary text. First sentence must carry the offer — Meta hides the rest behind 'See more'.",
    campos: [
      { chave: "primary_text", rotulo: "Primary text", alvo: 125, duro: 1024 },
      { chave: "headline", rotulo: "Headline", alvo: 40, duro: 255 },
      { chave: "description", rotulo: "Link description", alvo: 30, duro: 255 },
    ],
  },

  // ── LINKEDIN (Sponsored Content, single image ad)
  // Fonte: https://www.linkedin.com/help/lms/answer/a426534/single-image-ads-advertising-specifications (acessado 2026-08-11)
  //   introductory text: 150 antes de truncar / 3.000 duro
  //   headline: 70 antes de truncar / 200 duro
  //   description: 100 antes de truncar / 300 duro
  // ⚠️ CONFLITO ENTRE DUAS PÁGINAS OFICIAIS DA PRÓPRIA LINKEDIN: o Ads Guide
  // (https://business.linkedin.com/marketing-solutions/success/ads-guide/single-image-ads) lista
  // description = 70. Quando duas fontes oficiais discordam, fica a MENOR — errar para baixo custa
  // uma palavra; errar para cima custa a peça.
  linkedin: {
    nome: "LinkedIn Sponsored Content (single image ad)",
    fonte: "https://www.linkedin.com/help/lms/answer/a426534/single-image-ads-advertising-specifications (acessado 2026-08-11)",
    regras: "Professional register, no hype, no emoji. The first line must work alone — LinkedIn truncates the intro text at ~150 characters.",
    campos: [
      { chave: "intro", rotulo: "Introductory text", alvo: 150, duro: 3000 },
      { chave: "headline", rotulo: "Headline", alvo: 70, duro: 200 },
      { chave: "description", rotulo: "Description", alvo: 70, duro: 300 },
    ],
  },

  // ── TIKTOK (in-feed ad)
  // Fonte: https://ads.tiktok.com/help/article/image-ads-specification?lang=en (acessado 2026-08-11)
  //   ad description: 1–100 caracteres latinos (DURO) · 1–50 em CN/JP/KR · proíbe { } e #
  // O limite de exibição coincide com o duro (100), então alvo = duro.
  // NÃO DETERMINADO: o campo `ad_text` da Marketing API — o portal business-api.tiktok.com é
  // renderizado por JS e não devolveu texto verificável. Usamos o número da página de ajuda.
  tiktok: {
    nome: "TikTok In-Feed ad (ad description)",
    fonte: "https://ads.tiktok.com/help/article/image-ads-specification?lang=en (acessado 2026-08-11)",
    regras: "One single line. Spoken, first-person, no corporate voice. Never use the characters { } or #. Emoji: at most one.",
    campos: [{ chave: "texto", rotulo: "Ad text", alvo: 100, duro: 100 }],
  },

  // ── YOUTUBE (video action campaign / responsive video ad)
  // Fonte: https://support.google.com/google-ads/answer/17091270 (acessado 2026-08-11)
  //   headline 30 · long headline 90 · description 90 · call to action 10
  // O CTA NÃO é gerado pela IA aqui de propósito: 10 caracteres é curto demais para sobrar margem
  // de erro, e a chamada sai de um vocabulário fixo (chamadaDoNegocio, mais abaixo) que já cabe.
  // NÃO DETERMINADO: o limite do campo "business name" em video action campaigns — o campo existe
  // na API e nenhuma página oficial publica o número. Por isso ele não está aqui.
  youtube: {
    nome: "YouTube video action campaign (responsive video ad)",
    fonte: "https://support.google.com/google-ads/answer/17091270 (acessado 2026-08-11)",
    regras: "The headline is read in half a second over a video — one concrete promise, no wordplay. No emoji.",
    campos: [
      { chave: "headline", rotulo: "Headline", alvo: 30, duro: 30 },
      { chave: "long_headline", rotulo: "Long headline", alvo: 90, duro: 90 },
      { chave: "description", rotulo: "Description", alvo: 90, duro: 90 },
    ],
  },

  // ── CHATGPT / SUPERFÍCIE DE IA — a spec mais apertada de todas, e a única do gênero com número.
  // Fonte: https://developers.openai.com/ads/api-reference/ads.md (acessado 2026-08-11)
  //   creative.title: 3–50 (DURO) · creative.body: até 100 (DURO)
  // Formato `chat_card`. A segmentação não é por keyword exata, e sim por "context hints" — por
  // isso o prompt manda escrever a peça como RESPOSTA a quem já descreveu o problema, não como
  // isca de busca. É a diferença entre aparecer e fazer sentido no meio de uma conversa.
  //
  // OS OUTROS CANAIS DE IA FICARAM DE FORA, e o motivo importa:
  //   • Perplexity — nunca publicou spec de caracteres E encerrou a publicidade em fev/2026.
  //   • Microsoft Copilot — não tem formato de texto próprio: serve RSA. Quem quer anunciar lá usa
  //     o formato `bing` acima (mesmos 30/90). Os formatos nativos (Showroom, Offer Highlights)
  //     são invite-only e não têm spec pública de caracteres.
  // Inventar um limite para eles seria entregar peça que nenhuma plataforma aceita.
  chatgpt: {
    nome: "ChatGPT sponsored chat card (OpenAI Ads)",
    fonte: "https://developers.openai.com/ads/api-reference/ads.md (acessado 2026-08-11)",
    regras: "Write as a helpful answer to someone who just described this problem in a conversation — not as a search-bait slogan. No emoji, no hype, no exclamation marks. The title must be at least 3 characters.",
    campos: [
      { chave: "title", rotulo: "Title", alvo: 50, duro: 50, min: 3 },
      { chave: "body", rotulo: "Body", alvo: 100, duro: 100 },
    ],
  },
};

export const CANAIS = Object.keys(FORMATOS);
export const canalValido = (c) => Object.prototype.hasOwnProperty.call(FORMATOS, String(c || "").toLowerCase());

// A forma do JSON que a IA tem que devolver, DERIVADA dos campos. Escrita à mão em cada formato,
// ela e a lista de limites divergiriam no primeiro canal novo — e a divergência só apareceria em
// produção, como "a IA devolveu um campo que ninguém lê".
export function formaJSON(canal) {
  const f = FORMATOS[canal];
  const o = {};
  for (const c of f.campos) o[c.chave] = c.qtd ? new Array(c.qtd).fill("") : "";
  return JSON.stringify(o);
}

// A lista de limites em inglês, para o prompt. Mesma fonte de verdade do medidor.
export function regrasDeLimite(canal) {
  const f = FORMATOS[canal];
  return f.campos.map((c) => (c.qtd
    ? `${c.qtd} ${c.rotulo.toLowerCase()}s of MAX ${c.alvo} characters each`
    : `one ${c.rotulo.toLowerCase()} of MAX ${c.alvo} characters`)).join(", ");
}

// ── MEDIR O QUE PASSOU ───────────────────────────────────────────────────────────────────────
// Roda DUAS vezes (na resposta e depois da reescrita/apara) — comparar as duas é o que impede um
// "conserto" que piora de entrar no lugar do original.
// `duro:true` mede contra o limite de REJEIÇÃO em vez do de exibição.
export function medirExcesso(canal, criativo, { duro = false } = {}) {
  const f = FORMATOS[canal] || FORMATOS.google;
  const fora = [];
  for (const c of f.campos) {
    const lim = duro ? c.duro : c.alvo;
    if (c.qtd) {
      const arr = Array.isArray(criativo?.[c.chave]) ? criativo[c.chave] : [];
      arr.forEach((v, i) => { if (s(v).length > lim) fora.push(`${c.rotulo} ${i + 1}: ${s(v).length}/${lim}`); });
    } else {
      const n = s(criativo?.[c.chave]).length;
      if (n > lim) fora.push(`${c.rotulo}: ${n}/${lim}`);
    }
  }
  return fora;
}

// Campos que vieram VAZIOS (ou curtos demais para a plataforma aceitar, ex.: title mín. 3 no
// ChatGPT). Peça com campo vazio não é "quase pronta": é peça que a plataforma recusa e que o
// time só descobre depois de colar lá.
export function camposFaltando(canal, criativo) {
  const f = FORMATOS[canal] || FORMATOS.google;
  const faltam = [];
  for (const c of f.campos) {
    const min = c.min || 1;
    if (c.qtd) {
      const arr = Array.isArray(criativo?.[c.chave]) ? criativo[c.chave] : [];
      if (arr.filter((v) => s(v).trim().length >= min).length < c.qtd) faltam.push(`${c.rotulo} (${c.qtd})`);
    } else if (s(criativo?.[c.chave]).trim().length < min) faltam.push(c.rotulo);
  }
  return faltam;
}

// ── APARAR, MAS SÓ QUANDO É SEGURO ───────────────────────────────────────────────────────────
// Depois da reescrita ainda sobra 1–3 caracteres às vezes (foi o caso real: 31/30). Pedir uma
// terceira rodada à IA custa tempo e não converge; deixar passar entrega peça que o Google trunca
// no meio da palavra.
//
// A regra: só apara se o excesso é PEQUENO (≤3) e se der para cortar numa FRONTEIRA DE PALAVRA.
// Cortar "Coloração Profissional" em "Coloração Profissiona" é pior que o problema original.
// Quando não dá para cortar limpo, MANTÉM e avisa — anúncio longo que o time reescreve à mão é
// melhor que anúncio mutilado no ar.
export function aparar(txt, limite) {
  const t = s(txt);
  if (t.length <= limite) return t;
  if (t.length - limite > 3) return t;            // excesso grande → não é caso de apara
  const bruto = t.slice(0, limite);
  const ate = bruto.lastIndexOf(" ");
  const corte = (ate > 0 ? bruto.slice(0, ate) : bruto).replace(/[\s,;:—–.-]+$/, "");
  // Se o recuo comeu mais de 25% da peça, o texto virou outra coisa → devolve o original.
  return corte.length >= Math.floor(limite * 0.75) ? corte : t;
}

// Apara a peça inteira, campo a campo, pelos limites de EXIBIÇÃO do canal.
export function apararPeca(canal, criativo) {
  const f = FORMATOS[canal] || FORMATOS.google;
  const out = { ...criativo };
  for (const c of f.campos) {
    if (c.qtd) { if (Array.isArray(out[c.chave])) out[c.chave] = out[c.chave].map((v) => aparar(v, c.alvo)); }
    else out[c.chave] = aparar(out[c.chave], c.alvo);
  }
  return out;
}

// Todo o texto publicável da peça, em uma string — o que a auditoria de fatos precisa ler.
export function textoDaPeca(canal, criativo) {
  const f = FORMATOS[canal] || FORMATOS.google;
  const partes = [];
  for (const c of f.campos) {
    if (c.qtd) partes.push(...(Array.isArray(criativo?.[c.chave]) ? criativo[c.chave] : []).map(s));
    else partes.push(s(criativo?.[c.chave]));
  }
  return partes.filter(Boolean).join("\n");
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// A LEI DE NÃO INVENTAR — e por que ela não pode viver só no prompt
// ═════════════════════════════════════════════════════════════════════════════════════════════
// O prompt já proíbe inventar desconto, garantia, prazo e preço. Prompt é pedido, não trava: o
// modelo obedece quase sempre, e "quase sempre" num anúncio significa que uma peça em vinte sai
// prometendo "15% OFF" que não existe — no nome do CLIENTE, que é quem responde por propaganda
// enganosa e leva a conta reprovada.
//
// Esta função é a trava DETERMINÍSTICA que roda depois: procura a promessa no texto e confere se
// ela existe nos FATOS (cardápio com preços, cérebro do negócio, e o que o próprio dono digitou
// no briefing — o dono PODE autorizar uma oferta; a IA não pode inventá-la).
//
// Superlativo é o único caso sem perdão: "o melhor", "nº 1", "mais barato" são reprovados pelas
// plataformas e por órgãos de defesa do consumidor mesmo quando o dono acredita neles.
const semAcento = (t) => s(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Categorias que NÃO consultam os fatos: nenhuma informação do negócio as autoriza.
const SEM_PERDAO = new Set(["cura/tratamento médico", "promessa de ganho financeiro"]);

const SUPERLATIVOS = [
  // Sem exigir artigo: "Melhor Salao De Miami" (título capitalizado, sem "o") passava batido —
  // e título capitalizado é exatamente como anúncio é escrito. Achado por revisão adversarial.
  /\bmelhor\b/, /\bthe\s+best\b/, /\bbest\b/, /\bmejor\b/,
  /\bnumero\s*1\b/, /\bn[º°]\s*1\b/, /#\s?1\b/, /\bnumber\s*one\b/,
  /\bmais\s+barato\b/, /\bmas\s+barato\b/, /\bcheapest\b/, /\blowest\s+price\b/,
  /\blider\s+(de|do|da|em)\b/, /\bmarket\s+leader\b/,
];

// Palavra de PROMESSA → só passa se aparecer nos fatos do negócio.
const PROMESSAS = [
  ["desconto", /\bdesconto\b|\bdescuento\b|\bdiscount\b|\b\d{1,3}\s?%\s?off\b|\boff\b/],
  ["grátis", /\bgratis\b|\bgratuit[oa]s?\b|\bfree\b|\bbrinde\b|\bcortesia\b/],
  ["garantia", /\bgarant(ia|ias|ido|idos|ida|idas|imos|e|em|ir)\b|\bgarantizad[oa]s?\b|\bgarantizamos\b|\bguarantee[d]?\b|\breembolso\b|\brefund\b|\bmoney\s?back\b/],
  ["promoção/sorteio", /\bpromo(cao|ção)?\b|\bsorteio\b|\bgiveaway\b|\bcashback\b|\bcupom\b|\bcoupon\b|\bsale\b/],
  ["prazo prometido", /\b24\s?h(oras)?\b|\bmesmo\s+dia\b|\bsame\s?-?\s?day\b|\bno\s+ato\b|\bimediat[oa]\b|\binstant(ly|aneo)?\b|\bmisma\s+d(i|í)a\b/],
  // "LEVE 2 PAGUE 1" — a oferta que o teste pegou e que a lista original deixava passar, porque
  // ela não contém nenhuma das palavras óbvias (desconto, grátis, %). É a mais cara de todas: o
  // negócio é obrigado a honrar meia venda que nunca autorizou.
  // ── CLAIM MÉDICO E FINANCEIRO: não existe "está nos fatos" que autorize ────────────────────
  // A proibição vivia SÓ no prompt, e prompt é pedido, não trava. Rodado de verdade, passavam
  // limpo: "Elimina a queda de cabelo e cura a alopecia" e "Dobre o seu faturamento em 60 dias".
  // Com clínicas nos playbooks da casa, é o pior caso possível deste arquivo — a peça sai no nome
  // do cliente e quem responde por ela é o negócio dele, não a Guileo.
  // Estes NÃO consultam os fatos: mesmo que o dono tenha escrito "curamos calvície" no briefing,
  // a peça não pode prometer cura. Autorizar o próprio erro não é autorização.
  ["cura/tratamento médico", /\bcura(r|m|do|da|ndo)?\b|\bcure[sd]?\b|\belimina(r|m|ndo)?\s+(a|o|as|os)?\s*(queda|dor|acne|celulite|gordura|calvicie|alopecia|ansiedade|depressao)\b|\btrata\s+(a|o)\s+\w+|\b(sem|zero)\s+(dor|risco|efeito\s+colateral)\b|\bresultado\s+(garantido|permanente|definitivo)\b|\bpermanente(mente)?\b|\bdefinitivo\b|\bcomprovado\s+cientificamente\b|\bclinicamente\s+comprovado\b|\bclinically\s+proven\b|\bfda[\s-]?approved\b/],
  ["promessa de ganho financeiro", /\bdobr(e|ar|amos)\s+(o\s+)?(seu\s+)?(faturamento|lucro|vendas|receita)\b|\btriplic(ar|e|amos)\b|\bdouble\s+your\s+(revenue|sales|profit)\b|\b(ganhe|fature|lucre)\s+(r\$|\$)?\s?\d/],
  ["oferta leve-e-pague", /\bleve\s*\d+\s*pague\s*\d+\b|\bcompre\s*\d+\s*(e\s*)?(leve|ganhe)\s*\d+\b|\bbuy\s*\d+\s*get\s*\d+\b|\bbogo\b|\b2\s?x\s?1\b|\blleva\s*\d+\s*paga\s*\d+\b|\b1\s?\+\s?1\b/],
];

/**
 * Monta o "o que pode ser dito" a partir dos fatos REAIS do tenant.
 * @param {{business?:string, industry?:string, brain?:string, menu?:Array}} ctx
 * @param {string} briefing  o que o próprio dono digitou (objetivo/público) — autoriza oferta
 */
export function fatosPermitidos(ctx = {}, briefing = "") {
  const menu = Array.isArray(ctx.menu) ? ctx.menu : [];
  const texto = semAcento([
    ctx.business, ctx.industry, ctx.brain, briefing,
    menu.map((v) => `${v?.name || ""} ${v?.description || ""}`).join(" "),
  ].filter(Boolean).join(" \n "));
  // Preços que EXISTEM no cardápio, nas duas escritas usuais ($45 e $45.00).
  const precos = new Set();
  for (const v of menu) {
    const c = Number(v?.price_cents);
    if (Number.isFinite(c) && c > 0) { precos.add((c / 100).toFixed(0)); precos.add((c / 100).toFixed(2)); }
  }
  return { texto, precos, temMenu: menu.length > 0 };
}

/**
 * Procura promessa que os fatos não sustentam.
 * @returns {string[]} motivos em português, prontos para o time ler. Vazio = peça limpa.
 */
export function auditarFatos(texto, permitido = { texto: "", precos: new Set() }) {
  const t = semAcento(texto);
  const fatos = s(permitido.texto);
  const motivos = [];

  for (const re of SUPERLATIVOS) {
    if (re.test(t)) { motivos.push("superlativo não comprovável (\"o melhor\", \"nº 1\", \"mais barato\") — as plataformas reprovam e o negócio responde por ele"); break; }
  }
  for (const [rotulo, re] of PROMESSAS) {
    const m = t.match(re);
    if (!m) continue;
    // CLAIM MÉDICO/FINANCEIRO NÃO TEM PERDÃO: não consulta os fatos. Nem o briefing do dono
    // autoriza prometer cura ou dobrar faturamento — autorizar o próprio erro não é autorização.
    if (SEM_PERDAO.has(rotulo)) { motivos.push(`${rotulo} ("${m[0]}") não pode ser prometido em anúncio, mesmo que o negócio acredite`); continue; }
    // A EXPRESSÃO EXATA, não a categoria. Antes bastava a regex casar em QUALQUER lugar dos
    // fatos: "estacionamento grátis" no cardápio liberava "botox capilar grátis" na peça —
    // a palavra existia, então a categoria inteira passava. Agora o que precisa estar nos fatos
    // é o trecho que a peça usou.
    // A PROMESSA É A PALAVRA **MAIS O QUE ELA QUALIFICA**. Comparar só a palavra ainda deixava
    // passar o caso que importa: "estacionamento grátis" no cardápio liberava "botox capilar
    // grátis" na peça — a palavra existia, e a peça oferecia outra coisa de graça.
    // Então a checagem usa uma JANELA: as duas palavras antes do gatilho + o gatilho. Essa janela
    // é que precisa estar nos fatos.
    const antes = t.slice(0, m.index).trim().split(/\s+/).slice(-2);
    const janela = [...antes, m[0]].join(" ").trim();
    const passa = fatos.includes(janela) || (antes.length && fatos.includes([antes[antes.length - 1], m[0]].join(" ")));
    if (!passa) motivos.push(`promessa de ${rotulo} ("${janela}") não está nos fatos do negócio`);
  }
  // Percentual: só passa se o MESMO número aparecer nos fatos.
  for (const m of t.matchAll(/(\d{1,3})\s?%/g)) {
    if (!fatos.includes(`${m[1]}%`) && !fatos.includes(`${m[1]} %`)) motivos.push(`percentual "${m[0]}" não está nos fatos do negócio`);
  }
  // Preço: só passa se estiver no cardápio (ou tiver sido digitado pelo dono).
  for (const m of t.matchAll(/\$\s?(\d+(?:[.,]\d{1,2})?)/g)) {
    const n = m[1].replace(",", ".");
    // PREÇO SÓ VALE SE FOR PREÇO. `fatos.includes(n)` casava por SUBSTRING: "Miami desde 2019"
    // nos fatos liberava "$19" na peça, porque "19" está dentro de "2019". Agora o número tem que
    // estar no cardápio (fonte estruturada) ou aparecer nos fatos COM cifrão — texto solto não
    // vira autorização de preço.
    const ok = (permitido.precos && (permitido.precos.has(n) || permitido.precos.has(String(Number(n).toFixed(0)))))
      || new RegExp(`\\$\\s?${n.replace(".", "\\.")}\\b`).test(fatos);
    if (!ok) motivos.push(`preço "${m[0]}" não está no cardápio cadastrado`);
  }
  return [...new Set(motivos)];
}

// ── A CHAMADA (call to action) ───────────────────────────────────────────────────────────────
// Vocabulário FIXO, escolhido por nós — não gerado pela IA. Dois motivos:
//   1. o CTA do YouTube tem 10 caracteres; 10 não deixa margem para a IA errar;
//   2. a chamada é uma PROMESSA de canal ("agende" só vale se o negócio agenda). Derivar dos
//      fatos (tem cardápio/serviço → agendar; não tem → falar com a gente) é honesto por
//      construção, e de graça.
const CHAMADAS = {
  pt: { agendar: "Agendar", falar: "Falar agora", ligar: "Ligar" },
  en: { agendar: "Book now", falar: "Get a quote", ligar: "Call now" },
  es: { agendar: "Reservar", falar: "Hablar", ligar: "Llamar" },
  hi: { agendar: "बुक करें", falar: "बात करें", ligar: "कॉल करें" },
};
export function chamadaDoNegocio(ctx = {}, lang = "en") {
  const d = CHAMADAS[lang] || CHAMADAS.en;
  const temAgenda = Array.isArray(ctx.menu) && ctx.menu.length > 0;
  return { texto: temAgenda ? d.agendar : d.falar, alternativa: d.ligar, base: temAgenda ? "o negócio tem serviços cadastrados — a chamada pede agendamento" : "sem serviços cadastrados — a chamada convida a conversar, não promete agenda" };
}

// ── O PÚBLICO SUGERIDO ───────────────────────────────────────────────────────────────────────
// Sai dos FATOS, não da imaginação. Se o negócio tem 3 serviços cadastrados, o público é quem
// procura por eles; se não tem nada cadastrado, a resposta honesta é dizer que não dá para sugerir
// segmentação — e não inventar "mulheres 25-45 interessadas em bem-estar", que é o placeholder que
// toda agência entrega e ninguém consegue justificar.
export function publicoSugerido(ctx = {}, informado = "") {
  if (s(informado).trim()) return { publico: s(informado).trim(), origem: "informado pelo dono no briefing", confianca: "alta" };
  const menu = (Array.isArray(ctx.menu) ? ctx.menu : []).filter((v) => v && v.name).slice(0, 5);
  const setor = s(ctx.industry).trim();
  if (!menu.length && !setor) {
    return { publico: "", origem: "sem cardápio e sem setor cadastrados", confianca: "nenhuma",
      aviso: "Não dá para sugerir público: o negócio não tem serviços nem setor cadastrados. Cadastre os serviços (cockpit → Agenda/Serviços) e o público sai dos dados reais em vez de um chute." };
  }
  const termos = menu.map((v) => s(v.name).trim()).filter(Boolean);
  const publico = termos.length
    ? `Quem procura ${termos.slice(0, 3).join(", ")}${setor ? ` (${setor})` : ""} perto do negócio`
    : `Quem procura ${setor} perto do negócio`;
  return {
    publico,
    origem: termos.length ? `${termos.length} serviço(s) cadastrado(s)${setor ? " + setor do perfil" : ""}` : "setor do perfil",
    confianca: termos.length >= 3 ? "alta" : "média",
    termos,
  };
}
