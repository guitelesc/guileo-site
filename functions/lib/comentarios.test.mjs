// COMENTÁRIO → DM: o teste que separa "lead" de "denúncia de spam".
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// Um DM automático errado não é um bug neutro — quem recebe marca como spam, e denúncia de spam
// no direct é o que a Meta usa pra limitar a conta DO CLIENTE. O prejuízo não é nosso, é dele.
//
// Metade dos casos abaixo prova o que DEVE casar (senão o lead morre calado); a outra metade
// prova o que NÃO pode casar (senão a conta do cliente apanha). As duas metades são o produto.
import { normalizar, casaPalavra, campanhaCasa, escolherCampanha, podeMandar, montarDm } from "./comentarios.js";

let falhas = 0;
const ok = (cond, oque) => { if (!cond) { falhas++; console.log("  ✗ " + oque); } else console.log("  ✓ " + oque); };

console.log("\n— acento e pontuação (a armadilha do português) —");
ok(normalizar("PREÇO?!") === "preco", 'PREÇO?! → preco');
ok(normalizar("Promoção 🔥🔥") === "promocao", "emoji some junto com a pontuação");
ok(normalizar("  QUERO   \n saber ") === "quero saber", "espaço duplo e quebra de linha colapsam");

console.log("\n— casa o que TEM que casar (senão o lead morre calado) —");
for (const [texto, chave] of [
  ["preço", "PREÇO"], ["preco", "PREÇO"], ["PREÇO?", "preço"], ["Preço!!", "preco"],
  ["qual o preço disso", "preço"], ["me manda o PREÇO por favor", "preco"],
  ["🔥PREÇO🔥", "preço"],
]) ok(casaPalavra(normalizar(texto), normalizar(chave)), `"${texto}" casa com "${chave}"`);

console.log("\n— NÃO casa (senão a conta do cliente vira spam) —");
ok(!casaPalavra(normalizar("que precoce esse lançamento"), normalizar("preço")),
   '"precoce" NÃO dispara a chave "preço" (palavra inteira)');
ok(!casaPalavra(normalizar("imprecisao total"), normalizar("preco")), '"imprecisao" não contém a palavra "preco"');
ok(casaPalavra(normalizar("promocao10"), normalizar("promo"), "contem"),
   'modo "contem" pega chave colada ("promocao10" ← "promo") quando o dono ESCOLHE isso');

console.log("\n— post certo, e o post IMPULSIONADO (o que quebra no dia do anúncio) —");
const camp = { active: true, media_id: "POST_ORGANICO", keywords: ["preço"], match_mode: "palavra" };
ok(campanhaCasa(camp, { texto: "preço?", mediaId: "POST_ORGANICO" }) === "preço", "post orgânico casa");
ok(campanhaCasa(camp, { texto: "preço?", mediaId: "OUTRO_POST" }) === "", "post diferente NÃO casa");
ok(campanhaCasa(camp, { texto: "preço?", mediaId: "MEDIA_DO_ANUNCIO", originalMediaId: "POST_ORGANICO" }) === "preço",
   "comentário no post PROMOVIDO casa pelo original_media_id — sem isso a campanha morre no dia do anúncio");
ok(campanhaCasa({ ...camp, media_id: null }, { texto: "preço", mediaId: "QUALQUER" }) === "preço",
   "media_id vazio = vale pra todos os posts");
ok(campanhaCasa({ ...camp, active: false }, { texto: "preço", mediaId: "POST_ORGANICO" }) === "",
   "campanha desligada não dispara");

console.log("\n— duas campanhas casando: UMA pessoa, UM direct —");
const especifica = { id: "e", active: true, media_id: "P1", keywords: ["preço"], created_at: "2026-01-01" };
const geral = { id: "g", active: true, media_id: null, keywords: ["preço"], created_at: "2026-08-01" };
const escolha = escolherCampanha([geral, especifica], { texto: "preço", mediaId: "P1" });
ok(escolha && escolha.campanha.id === "e", "a campanha do POST específico ganha da genérica");
ok(escolherCampanha([geral, especifica], { texto: "oi tudo bem", mediaId: "P1" }) === null,
   "comentário sem palavra-chave não escolhe campanha nenhuma");

console.log("\n— freio anti-spam por PESSOA (o dedup por comentário não cobre isto) —");
ok(podeMandar(0, Infinity), "primeira vez: manda");
ok(!podeMandar(1, 2), "mesma pessoa comentando de novo em 2min: NÃO manda (é o mesmo pedido)");
ok(podeMandar(1, 30), "30min depois: manda (pedido novo de verdade)");
ok(!podeMandar(3, 120), "4º DM do dia pra mesma pessoa: NÃO manda (isso é rajada, não interesse)");

console.log("\n— texto do DM —");
ok(montarDm("Oi {nome}, o preço é...", { usuario: "ana", link: "https://g.co/x" })
   === "Oi @ana, o preço é...\n\nhttps://g.co/x", "{nome} vira @ e o link fica em linha própria");
ok(!montarDm("Oi {nome}, veja:", { usuario: "" }).includes("{nome}"),
   "sem username o placeholder some (nunca vaza '{nome}' cru pro cliente)");

console.log(falhas ? `\n❌ ${falhas} falha(s)\n` : "\n✅ comentarios.js: tudo passou\n");
process.exit(falhas ? 1 : 0);
