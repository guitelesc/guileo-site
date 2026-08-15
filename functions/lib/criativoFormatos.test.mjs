// Teste dos limites de anúncio e da lei de não inventar. Roda com:
//   node functions/lib/criativoFormatos.test.mjs
//
// POR QUE ESTE TESTE EXISTE: um limite errado não dá erro em lugar nenhum. A peça sai, o time cola
// no gerenciador, e a plataforma REPROVA (Meta) ou TRUNCA no meio da palavra (Google) — quem
// descobre é o cliente que pagou. Nenhuma revisão visual pega "31 de 30". E a lição da apara já
// custou uma vez: cortar no caractere exato transforma "Coloração Profissional" em
// "Coloração Profissiona" — pior que o problema original.
//
// Este arquivo não importa NADA de rede/banco de propósito: roda em node puro, sem chave de API.
import {
  FORMATOS, CANAIS, formaJSON, regrasDeLimite, medirExcesso, camposFaltando,
  aparar, apararPeca, textoDaPeca, auditarFatos, fatosPermitidos, chamadaDoNegocio, publicoSugerido,
} from "./criativoFormatos.js";

let ok = 0, falhas = 0;
const eq = (nome, got, esperado) => {
  const bom = JSON.stringify(got) === JSON.stringify(esperado);
  if (bom) ok++; else { falhas++; console.log(`❌ ${nome}\n   veio:     ${JSON.stringify(got)}\n   esperado: ${JSON.stringify(esperado)}`); }
  if (bom) console.log(`✅ ${nome}`);
};
const certo = (nome, cond, detalhe = "") => eq(nome + (detalhe ? ` (${detalhe})` : ""), !!cond, true);

// ── 1. TODO FORMATO TEM FONTE E LIMITES COERENTES ────────────────────────────────────────────
// A regra do projeto: limite sem fonte é limite inventado. Este caso impede que o próximo canal
// entre "provisoriamente sem fonte" e vire verdade por antiguidade.
for (const canal of CANAIS) {
  const f = FORMATOS[canal];
  certo(`${canal}: tem fonte com data de acesso`, /https?:\/\/.+acessado \d{4}-\d{2}-\d{2}/.test(f.fonte || ""));
  certo(`${canal}: tem pelo menos um campo`, (f.campos || []).length > 0);
  for (const c of f.campos) {
    certo(`${canal}.${c.chave}: alvo ≤ duro`, c.alvo <= c.duro, `${c.alvo}/${c.duro}`);
    certo(`${canal}.${c.chave}: limites positivos`, c.alvo > 0 && c.duro > 0);
  }
}

// ── 2. OS NÚMEROS PESQUISADOS (se alguém mudar por engano, o teste grita) ─────────────────────
const lim = (canal, chave) => FORMATOS[canal].campos.find((c) => c.chave === chave);
eq("Google headline = 30 (alvo e duro)", [lim("google", "headlines").alvo, lim("google", "headlines").duro], [30, 30]);
eq("Google description = 90", [lim("google", "descriptions").alvo, lim("google", "descriptions").duro], [90, 90]);
eq("Bing = mesmos 30/90 do Google", [lim("bing", "headlines").alvo, lim("bing", "descriptions").alvo], [30, 90]);
// Meta: o 125/40 é RECOMENDAÇÃO de exibição; o duro é muito maior (asset_feed_spec).
eq("Meta primary text: 125 exibição / 1024 duro", [lim("meta", "primary_text").alvo, lim("meta", "primary_text").duro], [125, 1024]);
eq("Meta headline: 40 / 255", [lim("meta", "headline").alvo, lim("meta", "headline").duro], [40, 255]);
// LinkedIn: o caso extremo — 150 trunca, 3000 rejeita. Aparar em 3000 = anúncio válido e morto.
eq("LinkedIn intro: 150 exibição / 3000 duro", [lim("linkedin", "intro").alvo, lim("linkedin", "intro").duro], [150, 3000]);
eq("TikTok ad text: 100 duro", [lim("tiktok", "texto").alvo, lim("tiktok", "texto").duro], [100, 100]);
eq("YouTube: 30 / 90 / 90", [lim("youtube", "headline").alvo, lim("youtube", "long_headline").alvo, lim("youtube", "description").alvo], [30, 90, 90]);
eq("ChatGPT chat card: title 50 (mín 3) / body 100", [lim("chatgpt", "title").alvo, lim("chatgpt", "title").min, lim("chatgpt", "body").alvo], [50, 3, 100]);

// ── 3. O MEDIDOR ─────────────────────────────────────────────────────────────────────────────
const x = (n) => "x".repeat(n);
eq("no limite exato não acusa", medirExcesso("google", { headlines: [x(30), x(30), x(30)], descriptions: [x(90), x(90)] }), []);
eq("1 caractere a mais acusa, com o número", medirExcesso("google", { headlines: [x(31), x(30), x(30)], descriptions: [x(90), x(90)] }), ["Headline 1: 31/30"]);
eq("mede cada canal pelo SEU limite", medirExcesso("chatgpt", { title: x(51), body: x(100) }), ["Title: 51/50"]);
// A distinção que muda o desenho: 200 caracteres no LinkedIn passam do que a tela mostra (150),
// mas não do que a API aceita (3000). Aviso diferente, decisão diferente.
eq("LinkedIn 200 chars: trunca na tela", medirExcesso("linkedin", { intro: x(200), headline: x(70), description: x(70) }), ["Introductory text: 200/150"]);
eq("LinkedIn 200 chars: NÃO é rejeição", medirExcesso("linkedin", { intro: x(200), headline: x(70), description: x(70) }, { duro: true }), []);

// ── 4. A APARA (a lição que já custou caro) ──────────────────────────────────────────────────
eq("não mexe no que cabe", aparar(x(30), 30), x(30));
eq("excesso grande (>3) NÃO é caso de apara — devolve inteiro", aparar(x(34), 30), x(34));
// Corta na fronteira da palavra: 24 x + espaço + 6 y = 31, limite 30 → sobra o bloco inteiro de x.
eq("apara na PALAVRA INTEIRA, nunca no meio", aparar(`${x(24)} ${"y".repeat(6)}`, 30), x(24));
// Quando recuar até a palavra inteira come mais de 25% da peça, mantém o original e avisa:
// frase mutilada é pior que frase longa.
eq("recusa aparar quando o corte destrói a frase", aparar(`xy ${"z".repeat(29)}`, 30), `xy ${"z".repeat(29)}`);
eq("apara a peça inteira campo a campo", apararPeca("meta", { primary_text: `${x(119)} ${"y".repeat(8)}`, headline: x(40), description: x(30) }).primary_text, x(119));

// ── 5. CAMPO VAZIO NÃO É "QUASE PRONTO" ──────────────────────────────────────────────────────
eq("acusa headline faltando", camposFaltando("google", { headlines: [x(10), "", x(10)], descriptions: [x(10), x(10)] }), ["Headline (3)"]);
eq("peça completa não acusa nada", camposFaltando("google", { headlines: [x(10), x(10), x(10)], descriptions: [x(10), x(10)] }), []);
// ChatGPT exige title com 3+ caracteres — "Oi" seria rejeitado pela API.
eq("respeita o mínimo do canal (ChatGPT title ≥ 3)", camposFaltando("chatgpt", { title: "Oi", body: x(50) }), ["Title"]);

// ── 6. A FORMA DO JSON SAI DOS CAMPOS (nunca escrita à mão duas vezes) ───────────────────────
eq("forma do Google", formaJSON("google"), '{"headlines":["","",""],"descriptions":["",""]}');
eq("forma do ChatGPT", formaJSON("chatgpt"), '{"title":"","body":""}');
certo("as regras do prompt citam o limite real", regrasDeLimite("meta").includes("125") && regrasDeLimite("meta").includes("40"));

// ── 7. A LEI DE NÃO INVENTAR ─────────────────────────────────────────────────────────────────
// O negócio de teste: dois serviços com preço, nenhuma oferta.
const CTX = { business: "Salão Natura", industry: "salão de beleza", menu: [{ name: "Corte", price_cents: 4500 }, { name: "Coloração", price_cents: 12000 }] };
const P = fatosPermitidos(CTX, "");

eq("desconto inventado é bloqueado", auditarFatos("Corte com 20% de desconto hoje", P).length > 0, true);
eq("percentual inventado aparece no motivo", auditarFatos("20% OFF no corte", P).some((m) => m.includes("20%")), true);
eq("grátis inventado é bloqueado", auditarFatos("Primeira avaliação grátis", P).length > 0, true);
eq("garantia inventada é bloqueada (com e sem acento)", [auditarFatos("Garantia de satisfação", P).length > 0, auditarFatos("satisfaction guaranteed", P).length > 0], [true, true]);
eq("prazo prometido é bloqueado", auditarFatos("Atendemos em 24h", P).length > 0, true);
eq("preço FORA do cardápio é bloqueado", auditarFatos("Corte por $29", P).some((m) => m.includes("$29")), true);
eq("preço DO cardápio passa", auditarFatos("Corte por $45", P), []);
eq("texto honesto passa limpo", auditarFatos("Corte e coloração com hora marcada. Agende hoje.", P), []);

// O DONO PODE autorizar uma oferta no briefing — a IA é que não pode inventá-la. Mesma lei do
// gerador de posts: "a menos que o briefing do usuário tenha fornecido exatamente essa oferta".
const P_COM_OFERTA = fatosPermitidos(CTX, "Campanha de aniversário: 20% de desconto na coloração");
eq("oferta digitada pelo DONO é permitida", auditarFatos("20% de desconto na coloração", P_COM_OFERTA), []);

// Superlativo não tem perdão nem com fato: a plataforma reprova e o negócio responde por ele.
const P_SUPER = fatosPermitidos({ ...CTX, brain: "somos o melhor salão da cidade" }, "");
eq("superlativo é bloqueado MESMO estando nos fatos", auditarFatos("O melhor salão da cidade", P_SUPER).length > 0, true);
eq("superlativo em inglês também", auditarFatos("The best hair salon in town", P).length > 0, true);
eq("nº 1 também", auditarFatos("Salão #1 de Miami", P).length > 0, true);

// A auditoria lê a peça INTEIRA, não só um campo — a promessa costuma vir na descrição.
eq("audita todos os campos da peça", auditarFatos(textoDaPeca("google", { headlines: ["Corte Com Hora Marcada", "Coloração Profissional", "Agende Hoje"], descriptions: ["Sem espera.", "Leve 2 pague 1 nesta semana."] }), P).length > 0, true);

// ── 8. PÚBLICO E CHAMADA SAEM DOS FATOS ──────────────────────────────────────────────────────
const pub = publicoSugerido(CTX, "");
certo("público sai dos serviços cadastrados", pub.publico.includes("Corte") && pub.origem.includes("serviço"));
const pubVazio = publicoSugerido({ business: "X" }, "");
eq("sem fatos, NÃO inventa público", [pubVazio.publico, pubVazio.confianca], ["", "nenhuma"]);
certo("sem fatos, diz o que fazer para melhorar", (pubVazio.aviso || "").length > 20);
eq("público digitado pelo dono vence", publicoSugerido(CTX, "mulheres 30+ no bairro").origem, "informado pelo dono no briefing");

// O CTA do YouTube tem 10 caracteres — o vocabulário fixo existe para caber SEMPRE.
for (const l of ["pt", "en", "es", "hi"]) {
  const c = chamadaDoNegocio(CTX, l);
  certo(`chamada (${l}) cabe no CTA de 10 do YouTube`, c.texto.length <= 10, `${c.texto} = ${c.texto.length}`);
}
eq("sem serviços, a chamada NÃO promete agenda", chamadaDoNegocio({ menu: [] }, "pt").texto, "Falar agora");


// ═════════════════════════════════════════════════════════════════════════════════════════════
// AUDITORIA DE FATOS — os 5 furos que a revisão adversarial provou (2026-08-11).
// Cada linha aqui é uma peça que SAIU limpa da auditoria antiga, no nome do cliente.
// A mais cara não é a mais óbvia: "botox capilar grátis" passava porque o cardápio tinha
// "estacionamento grátis" — a palavra existia, então a categoria inteira era liberada, e a peça
// oferecia OUTRA coisa de graça. Por isso a checagem virou JANELA (as 2 palavras antes + o
// gatilho), não palavra solta.
// ═════════════════════════════════════════════════════════════════════════════════════════════
{
  const fatos = fatosPermitidos({
    business: "Clinica X", industry: "clinic",
    menu: [{ name: "Estacionamento grátis" }, { name: "Botox", price_cents: 60000 }],
    brain: "Miami desde 2019",
  }, "");
  const CASOS_AUDITORIA = [
    ["Elimina a queda de cabelo e cura a alopecia", true,  "claim médico — não existe fato que autorize"],
    ["Dobre o seu faturamento em 60 dias",          true,  "promessa de ganho financeiro"],
    ["Melhor Salao De Miami",                       true,  "superlativo sem artigo (título capitalizado)"],
    ["Resultados garantidos, sem dor",              true,  "garantidos não casava com /garantia/"],
    ["Botox capilar grátis nesta semana",           true,  "categoria liberada por 'estacionamento grátis'"],
    ["Venha conhecer: estacionamento grátis",       false, "ESTE é fato real — não pode virar falso positivo"],
    ["Botox por $19",                               true,  "'19' casava por substring em 'Miami desde 2019'"],
    ["Botox por $600",                              false, "preço real do cardápio"],
    ["Agende seu Botox hoje",                       false, "peça limpa"],
  ];
  for (const [texto, deveBloquear, porque] of CASOS_AUDITORIA) {
    const motivos = auditarFatos(texto, fatos);
    const bloqueou = motivos.length > 0;
    eq(`auditoria ${deveBloquear ? "BLOQUEIA" : "libera"}: "${texto}" — ${porque}`,
       bloqueou, deveBloquear);
  }
}

console.log(`\n${ok}/${ok + falhas} casos corretos`);
if (falhas) process.exit(1);
