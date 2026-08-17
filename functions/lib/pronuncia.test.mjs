// GUARDA DA PRONÚNCIA — o nome do negócio dito errado é a primeira impressão estragada.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// 2026-08-16, o Luis ouvindo uma ligação real: "ele fala GUILEO bem, mas o Gui ele fala guai".
// O motor de voz lê com as regras do idioma dele — "Gui" em inglês só pode sair /gwaɪ/. Não é
// defeito do modelo: é a gente mandando grafia portuguesa para uma boca inglesa.
//
// O RISCO DESTE ARQUIVO É O OPOSTO DO ÓBVIO. Reescrever fonética demais estraga nome que já saía
// certo — e esse defeito ninguém procura depois, porque consta como "já corrigido". Por isso
// metade dos casos aqui prova o que NÃO pode mudar.
import { comoFalar, frasefalada } from "./pronuncia.js";

let falhas = 0;
const eq = (obtido, esperado, oque) => {
  if (obtido !== esperado) { falhas++; console.log(`❌ ${oque}\n     esperado ${JSON.stringify(esperado)}, obtido ${JSON.stringify(obtido)}`); }
};

// ── O CASO QUE ORIGINOU TUDO
eq(comoFalar("Gui", "en"), "Ghee", "Gui em inglês vira Ghee (senão sai 'guai')");
eq(comoFalar("Gui", "pt"), "Gui", "Gui em português NÃO muda — já sai certo");
eq(comoFalar("Gui", "es"), "Gui", "Gui em espanhol NÃO muda");

// ── O QUE JÁ ESTAVA CERTO NÃO PODE SER MEXIDO. O Luis confirmou GUILEO de ouvido; se alguém
//    "melhorar" isso no futuro, quebra o que funciona e ninguém vai procurar aqui.
eq(comoFalar("Guileo", "en"), "Guileo", "GUILEO em inglês fica como está (verificado de ouvido)");
eq(comoFalar("Lilian", "en"), "Lilian", "Lilian o inglês lê bem");

// ── NOME DESCONHECIDO VOLTA INTACTO. Silêncio é o padrão seguro: fonética por palpite erra em
//    cima de nome que já saía certo.
eq(comoFalar("Amanda", "en"), "Amanda", "nome fora da tabela não é adivinhado");
eq(comoFalar("", "en"), "", "vazio continua vazio");

// ── MERCADO IMIGRANTE: a razão de a tabela existir. Estes o inglês erra feio.
eq(comoFalar("João", "en"), "Zhoo-ow", "acento não impede o casamento (João → joao)");
eq(comoFalar("Jorge", "en"), "Hor-hey", "Jorge em inglês sairia com J inglês");
eq(comoFalar("Jorge", "es"), "Jorge", "em espanhol Jorge já sai certo");

// ── A FRASE INTEIRA, que é o que vai para o motor de voz.
eq(frasefalada("Thank you for calling Guileo. This is Gui — how may I help you?", "en"),
   "Thank you for calling Guileo. This is Ghee — how may I help you?",
   "na saudação: troca Gui, preserva Guileo");
eq(frasefalada("Obrigada por ligar! Aqui é a Gui.", "pt"),
   "Obrigada por ligar! Aqui é a Gui.",
   "em português a saudação fica intacta");

// ── CAIXA PRESERVADA: "GUI" gritado no texto não pode virar "Ghee" minúsculo no meio da frase.
eq(frasefalada("GUI here.", "en"), "GHEE here.", "maiúsculas preservadas");

// ── ⚠️ LIMITE DE PALAVRA: sem isto, "Guilherme" viraria "Gheelherme" e "seguindo" viraria outra
//    coisa. É o modo mais provável de esta tabela causar dano.
eq(frasefalada("Guilherme is here.", "en"), "Guilherme is here.", "não mexe DENTRO de outra palavra");
eq(frasefalada("Aqui é o Guimarães.", "pt"), "Aqui é o Guimarães.", "idem com acento à frente");

if (falhas) {
  console.log(`\n${falhas} caso(s) errado(s). As duas falhas possíveis têm donos diferentes:`);
  console.log("   não corrigir  -> a agente diz o nome do negócio errado na PRIMEIRA frase da ligação;");
  console.log("   corrigir demais -> estraga nome que já saía certo, e ninguém procura defeito no que consta corrigido.");
  process.exit(1);
}
console.log("✅ pronúncia: 'Gui' sai certo em cada idioma, o que já estava bom não foi tocado, e nome dentro de palavra não é quebrado");
