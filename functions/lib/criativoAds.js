// functions/lib/criativoAds.js — O CRIATIVO DO ANÚNCIO, E O KIT QUE O TIME PUBLICA.
//
// POR QUE É PEÇA SEPARADA DO POST DE REDE SOCIAL:
// um post de Instagram e um anúncio de Google não são a mesma coisa escrita menor. O post existe
// para quem JÁ segue o negócio e rola o feed sem intenção; o anúncio interrompe um estranho que
// está procurando outra coisa, tem limite duro de caracteres e precisa de uma promessa concreta na
// primeira linha, porque não há segunda. Entregar post de rede social como "criativo de anúncio" é
// o tipo de coisa que faz o cliente pagar retainer de agência e não crescer.
//
// ── POR QUE ISTO É O QUE DÁ PARA CONSTRUIR HOJE ──────────────────────────────────────────────
// Publicar sozinho no Google/Meta/TikTok/LinkedIn depende de token, conta de anúncio aprovada e
// review de plataforma — coisa que não está na nossa mão. ESCREVER a peça no formato exato de cada
// canal não depende de ninguém. Então o produto é o KIT: o conjunto pronto que o time da Guileo
// cola no gerenciador de manhã. É honesto (nada finge estar publicado) e é exatamente o trabalho
// que a agência faz à mão hoje.
//
// ── A REGRA QUE NÃO SE AFROUXA ───────────────────────────────────────────────────────────────
// Só fato REAL do negócio — serviço que existe, preço cadastrado, oferta que o próprio dono
// digitou. E não confiamos só no prompt para isso: existe uma auditoria determinística
// (auditarFatos, em criativoFormatos.js) que roda DEPOIS e bloqueia a peça que prometeu o que o
// negócio não tem. Anúncio com promessa inventada não é marketing ruim: é o cliente respondendo
// por propaganda enganosa, e a plataforma reprovando a conta dele.
import { brandContext } from "../api/social-publish.js";
import { askClaude } from "./guiBrain.js";
import {
  FORMATOS, CANAIS, formaJSON, regrasDeLimite, medirExcesso, camposFaltando,
  apararPeca, textoDaPeca, auditarFatos, fatosPermitidos, chamadaDoNegocio, publicoSugerido,
} from "./criativoFormatos.js";

const s = (v, n = 200) => String(v == null ? "" : v).slice(0, n);

// Apelidos que a tela (e o vendedor na reunião) usam de verdade. Sem isto, "facebook" cairia no
// default silenciosamente e o time receberia peça de Google achando que era de Meta.
const APELIDOS = {
  facebook: "meta", fb: "meta", instagram: "meta", ig: "meta",
  microsoft: "bing", msft: "bing", copilot: "bing",   // Copilot serve RSA — mesmo formato do Bing
  openai: "chatgpt", ia: "chatgpt", ai: "chatgpt", chat: "chatgpt",
  yt: "youtube", video: "youtube", li: "linkedin", tt: "tiktok",
};
export function normalizarCanal(c) {
  const k = String(c || "").trim().toLowerCase();
  const alvo = APELIDOS[k] || k;
  return Object.prototype.hasOwnProperty.call(FORMATOS, alvo) ? alvo : "google";
}

// `pt-br` NÃO é `pt` para quem só compara os dois primeiros caracteres — mas é o mesmo idioma.
// Essa confusão já custou uma agente falando inglês numa ligação em português; aqui custaria o
// orçamento inteiro em cliques de gente que não converte.
const NOME_IDIOMA = { pt: "Brazilian Portuguese", es: "LatAm Spanish", hi: "Hindi", en: "English" };
export function idiomaDoNegocio(opts = {}, ctx = {}) {
  const cru = String(opts.lang || ctx.lang || "").trim().toLowerCase();
  const dois = cru.slice(0, 2);
  const lang = ["en", "pt", "es", "hi"].includes(dois) ? dois : "en";
  return { lang, langName: NOME_IDIOMA[lang] };
}

// Extrai o bloco JSON. Pedir "só JSON" e assumir que veio só JSON é confiança cega: o modelo às
// vezes embrulha em ```json, às vezes escreve uma linha antes. Do primeiro { ao último } sobrevive
// aos dois casos; quando NADA parece JSON, o chamador devolve o texto cru no erro — para o próximo
// não ficar adivinhando o que veio.
function extrairJSON(bruto) {
  const ini = bruto.indexOf("{"), fim = bruto.lastIndexOf("}");
  if (ini < 0 || fim <= ini) return null;
  try { return JSON.parse(bruto.slice(ini, fim + 1)); } catch { return null; }
}

/**
 * UMA peça, num canal, já medida, aparada e AUDITADA contra os fatos do negócio.
 * Nunca devolve peça vazia "publicável": ou vem com texto, ou vem com `erro`/`bloqueado` dizendo
 * o motivo real. Peça em branco entregue como sucesso é o pior desfecho possível — o time cola
 * no gerenciador e descobre na hora do lance.
 */
export async function gerarPeca(env, { canal, ctx, lang, langName, objetivo, publico, permitido }) {
  const f = FORMATOS[canal];
  const menu = (ctx.menu || []).map((v) => `• ${v.name}${v.price_cents ? ` — $${(v.price_cents / 100).toFixed(0)}` : ""}`).join("\n");

  const system = [
    `You write paid-ad copy for "${ctx.business || "this business"}"${ctx.industry ? `, a ${ctx.industry} business` : ""}, in ${langName}.`,
    `Format: ${f.nome}. Produce exactly: ${regrasDeLimite(canal)}.`,
    `Channel rules: ${f.regras}`,
    ctx.tone ? `Brand tone: ${ctx.tone}` : "",
    // AS TRAVAS. Cada uma existe porque o oposto custa dinheiro ou credibilidade do cliente.
    "NEVER invent a service, a price, a discount, a guarantee, a deadline or a result. Use ONLY the facts given below.",
    "If no price is given for a service, do not mention price at all.",
    "Do not write a discount, a free offer or a guarantee unless it appears VERBATIM in the facts or in the campaign brief.",
    "No superlatives you cannot prove (\"the best\", \"number one\", \"cheapest\"). Regulators and ad platforms reject those, and the business — not you — answers for them.",
    "Never promise a medical, legal or financial outcome.",
    "Write for someone who has a problem RIGHT NOW and is comparing options — not for a follower.",
    "COUNT THE CHARACTERS of every field before answering. Going over the limit gets the ad truncated mid-word or rejected.",
    "Return ONLY valid JSON, no prose, no markdown fence.",
    `Shape: ${formaJSON(canal)}`,
  ].filter(Boolean).join("\n");

  const brief = [
    objetivo ? `Goal of this campaign: ${s(objetivo, 200)}` : "Goal: bring new customers who book.",
    publico ? `Audience: ${s(publico, 300)}` : "",
    menu ? `REAL services and prices (the only ones you may cite):\n${menu}` : "No service list available — stay generic and cite no price.",
    ctx.brain ? `About the business (owner's own words):\n${s(ctx.brain, 1200)}` : "",
  ].filter(Boolean).join("\n\n");

  // askClaude é o ÚNICO executor da cadeia de modelos (guiBrain.js). Já repeti o loop com um modelo
  // fixo aqui, ele não respondeu, e o criativo voltou vazio. Reusar herda o fallback: se um modelo
  // cai, o próximo assume sozinho.
  // Criativo tem teto próprio: um kit de campanha pode disparar várias reescritas, e sem
  // propósito separado ele comeria o orçamento do eval sem ninguém ver de onde saiu.
  const bruto = (await askClaude(env, { system, messages: [{ role: "user", content: brief }], maxTokens: 700, proposito: "criativo" })).trim();
  if (!bruto) return { canal, nome: f.nome, fonte: f.fonte, erro: "a IA não respondeu (sem modelo disponível ou chave sem crédito)" };
  let criativo = extrairJSON(bruto);
  if (!criativo) return { canal, nome: f.nome, fonte: f.fonte, erro: `a IA não devolveu JSON válido — respondeu: ${bruto.slice(0, 160)}` };

  // ── RODADA DE CONSERTO: limite E fato, no MESMO pedido ────────────────────────────────────
  // Uma só. Se o modelo erra duas vezes, o problema é o pedido e não a sorte — e aí a resposta
  // honesta é entregar com o aviso à vista, em vez de gastar mais tempo e crédito.
  let excedeu = medirExcesso(canal, criativo);
  let mentiras = auditarFatos(textoDaPeca(canal, criativo), permitido);
  if (excedeu.length || mentiras.length) {
    const queixas = [
      excedeu.length ? `These fields exceed the hard character limit: ${excedeu.join("; ")}. Rewrite ONLY those, same meaning, same language, strictly within the limit.` : "",
      mentiras.length ? `These claims are NOT supported by the business facts and must be REMOVED entirely (do not soften them, delete them and say something true instead): ${mentiras.join("; ")}.` : "",
    ].filter(Boolean).join("\n");
    const conserto = (await askClaude(env, {
      system,
      messages: [
        { role: "user", content: brief },
        { role: "assistant", content: JSON.stringify(criativo) },
        { role: "user", content: `${queixas}\nCount characters before answering. Return the same JSON shape.` },
      ],
      maxTokens: 700,
    })).trim();
    const refeito = extrairJSON(conserto);
    if (refeito) {
      const ex2 = medirExcesso(canal, refeito);
      const me2 = auditarFatos(textoDaPeca(canal, refeito), permitido);
      // Só aceita a reescrita se ela ficou MELHOR nas DUAS contas. Um "conserto" que tira um
      // caractere e inventa um desconto é regressão — e é a regressão que ninguém percebe,
      // porque o contador de caracteres fica verde.
      if (me2.length <= mentiras.length && (ex2.length + me2.length) < (excedeu.length + mentiras.length)) {
        criativo = refeito; excedeu = ex2; mentiras = me2;
      }
    }
  }

  criativo = apararPeca(canal, criativo);
  excedeu = medirExcesso(canal, criativo);              // remede DEPOIS da apara — o aviso reflete o que sai
  const duro = medirExcesso(canal, criativo, { duro: true });
  const faltando = camposFaltando(canal, criativo);
  mentiras = auditarFatos(textoDaPeca(canal, criativo), permitido);

  const peca = {
    canal, nome: f.nome, fonte: f.fonte, criativo,
    // OS CAMPOS VÃO JUNTO DA PEÇA de propósito: assim a tela desenha QUALQUER canal (inclusive um
    // que eu ainda não escrevi) sem carregar uma segunda cópia da tabela de limites. Cópia de
    // limite na tela é a mentira que o time acredita, porque está escrita na frente dele.
    campos: f.campos.map((c) => ({ campo: c.chave, rotulo: c.rotulo, qtd: c.qtd || 1, limite: c.alvo, limite_rejeicao: c.duro })),
    // Devolvidos, nunca escondidos: quem publica precisa saber ANTES, não depois da reprovação.
    excedeu_limite: excedeu,        // passou do limite de EXIBIÇÃO (trunca na tela)
    excedeu_duro: duro,             // passou do limite de REJEIÇÃO da API
    faltando,
  };
  // BLOQUEIO: promessa que os fatos não sustentam sai do kit como bloqueada, com o motivo. Entregar
  // a peça "com um aviso pequeno" seria a mesma coisa que entregá-la — alguém publica.
  // BLOQUEIO TAMBÉM POR LIMITE DURO (2026-08-17). `duro` é onde a PLATAFORMA REJEITA, não onde ela
  // trunca. A apara se recusa de propósito a cortar excesso grande (>3 chars) para não desfigurar o
  // texto — então uma descrição de 97/90 sobrevive inteira. Chamar isso de `publicavel` é entregar
  // ao time uma peça que o Google reprova no momento em que ele cola: o mesmo defeito que
  // `camposFaltando` existe para evitar, e a única que passou no primeiro kit real.
  if (mentiras.length) { peca.bloqueado = mentiras; peca.publicavel = false; }
  else if (duro.length) { peca.bloqueado = duro.map((d) => `passa do limite de rejeição da plataforma — ${d}`); peca.publicavel = false; }
  else peca.publicavel = faltando.length === 0;
  return peca;
}

/**
 * COMPATIBILIDADE: uma peça só, no formato que /api/ads action:"criativo" já devolve.
 * @returns {{ plataforma, idioma, negocio, criativo, excedeu_limite } | { erro } | null}  null = sem chave de IA
 */
export async function gerarCriativoAds(env, email, opts = {}) {
  if (!env.ANTHROPIC_API_KEY && !env.ELEVENLABS_API_KEY) return null;
  const ctx = await contextoDoNegocio(env, email, opts);
  const canal = normalizarCanal(opts.plataforma || opts.canal);
  const { lang, langName } = idiomaDoNegocio(opts, ctx);
  const permitido = fatosPermitidos(ctx, `${s(opts.objetivo, 300)} ${s(opts.publico, 300)}`);
  try {
    const p = await gerarPeca(env, { canal, ctx, lang, langName, objetivo: opts.objetivo, publico: opts.publico, permitido });
    if (p.erro) return { erro: p.erro };
    return {
      plataforma: canal, canal, nome: p.nome, fonte: p.fonte, campos: p.campos,
      idioma: lang, negocio: ctx.business || "",
      criativo: p.criativo, excedeu_limite: p.excedeu_limite, excedeu_duro: p.excedeu_duro,
      faltando: p.faltando, bloqueado: p.bloqueado || [], publicavel: p.publicavel,
    };
  } catch (e) { return { erro: String(e).slice(0, 140) }; }
}

// O contexto do negócio — do banco, ou digitado.
// CONTEXTO POR FORA, para o VENDEDOR: na reunião o prospect ainda não é cliente, não existe perfil
// para ler. Mostrar o anúncio que rodaria PARA O NEGÓCIO DELE, ali na hora, é o momento que fecha
// venda. A trava não muda — sem cardápio real, o prompt proíbe citar preço e a auditoria bloqueia.
async function contextoDoNegocio(env, email, opts) {
  if (!opts.contexto) return await brandContext(env, email);
  const c = opts.contexto;
  return {
    business: s(c.business, 160), industry: s(c.industry, 80), tone: s(c.tone, 200),
    lang: s(c.lang, 5), brain: s(c.notas || c.brain, 1200),
    menu: Array.isArray(c.menu) ? c.menu.filter((v) => v && v.name).slice(0, 20) : [],
  };
}

/**
 * O KIT DE CAMPANHA — o que o time da Guileo realmente publica de manhã.
 *
 * Um pedido, um conjunto: as peças de cada canal (cada uma no formato exato dele), o PÚBLICO
 * sugerido a partir do que o negócio realmente tem cadastrado, e a CHAMADA. Peça solta obriga
 * alguém a montar a campanha à mão em volta dela — e é aí que entra o placeholder inventado
 * ("mulheres 25-45 interessadas em bem-estar") que ninguém consegue justificar.
 *
 * Canais que falham NÃO derrubam o kit: cada peça carrega o próprio erro. Uma campanha com 3 de 4
 * canais prontos é entregável; um 500 porque o LinkedIn engasgou não é.
 *
 * @returns {{ negocio, idioma, publico, chamada, pecas, avisos, canais_pedidos } | null}
 */
export async function gerarKitCampanha(env, email, opts = {}) {
  if (!env.ANTHROPIC_API_KEY && !env.ELEVENLABS_API_KEY) return null;
  const ctx = await contextoDoNegocio(env, email, opts);
  const { lang, langName } = idiomaDoNegocio(opts, ctx);

  // No máximo 4 canais por pedido: cada canal é 1–2 chamadas de modelo, e um kit de 7 canais numa
  // requisição só estoura o tempo do Worker — a peça fica pronta e ninguém recebe.
  const pedidos = Array.isArray(opts.canais) && opts.canais.length ? opts.canais : ["google", "meta"];
  const canais = [...new Set(pedidos.map(normalizarCanal))].slice(0, 4);

  const briefing = `${s(opts.objetivo, 300)} ${s(opts.publico, 300)}`;
  const permitido = fatosPermitidos(ctx, briefing);
  const pub = publicoSugerido(ctx, opts.publico);
  const cta = chamadaDoNegocio(ctx, lang);

  const avisos = [];
  if (!permitido.temMenu) avisos.push("Sem serviços/preços cadastrados: as peças saem GENÉRICAS e sem preço. Cadastre o cardápio e o mesmo pedido devolve peça concreta.");
  if (pub.aviso) avisos.push(pub.aviso);
  if (!ctx.brain) avisos.push("Sem o texto do negócio (cérebro/onboarding): a IA escreveu só com nome, setor e cardápio.");

  const pecas = await Promise.all(canais.map((canal) =>
    gerarPeca(env, { canal, ctx, lang, langName, objetivo: opts.objetivo, publico: pub.publico, permitido })
      .catch((e) => ({ canal, nome: FORMATOS[canal].nome, fonte: FORMATOS[canal].fonte, erro: String(e).slice(0, 140) }))
  ));

  const bloqueadas = pecas.filter((p) => p.bloqueado?.length).length;
  // O motivo VAI JUNTO da contagem: bloqueio agora tem duas causas (promessa sem lastro e limite de
  // rejeição da plataforma), e um aviso que só cita uma manda o time procurar o defeito errado.
  if (bloqueadas) avisos.push(`${bloqueadas} peça(s) bloqueada(s) — promessa que os fatos do negócio não sustentam, ou texto acima do limite em que a plataforma REJEITA. Elas não saem para publicação; o motivo está em cada peça, no campo "bloqueado".`);

  return {
    negocio: ctx.business || "", setor: ctx.industry || "", idioma: lang,
    objetivo: s(opts.objetivo, 200) || "",
    publico: pub,           // { publico, origem, confianca, ... } — a ORIGEM importa tanto quanto o texto
    chamada: cta,           // { texto, alternativa, base }
    canais_pedidos: canais,
    pecas,
    prontas: pecas.filter((p) => p.publicavel).length,
    avisos,
    gerado_em: new Date().toISOString(),
  };
}

export { CANAIS, FORMATOS };
