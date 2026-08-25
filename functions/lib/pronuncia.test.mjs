// GUARDA DA PRONÚNCIA — a primeira palavra da ligação é o nome, e ele tem que sair certo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// 2026-08-16, o Luis ouvindo a ligação: "ele fala GUILEO bem, mas o Gui ele fala guai".
// O motor de voz lê o texto com as regras do idioma DELE — "Gui" em inglês só pode sair /gwaɪ/.
// Não é defeito do modelo: é a gente entregando a grafia errada para a boca errada.
//
// O RISCO DESTE TESTE É O OPOSTO DO ÓBVIO. Reescrever fonética por palpite estraga nome que já
// saía certo — e ESSE defeito ninguém procura, porque o nome consta como "já corrigido". Por isso
// metade dos casos abaixo prova o que NÃO pode ser tocado: Guileo em inglês (o Luis confirmou que
// sai bem), Gui em português, Lilian em qualquer idioma.
import { comoFalar, frasefalada } from "./pronuncia.js";

let falhas = 0;
const eq = (obtido, esperado, titulo, porque) => {
  if (obtido === esperado) return;
  falhas++;
  console.log(`❌ ${titulo}\n     esperado ${JSON.stringify(esperado)} · obtido ${JSON.stringify(obtido)}\n     protege: ${porque}`);
};

// ── O CASO REAL ────────────────────────────────────────────────────────────────────────────────
eq(comoFalar("Gui", "en"), "Ghee", "Gui em inglês",
  "o defeito ouvido: 'guai' rimando com why. 'Ghee' é a grafia inglesa que produz /gi/.");

// ── O QUE NÃO PODE SER TOCADO (confirmado de ouvido) ───────────────────────────────────────────
eq(comoFalar("Guileo", "en"), "Guileo", "Guileo em inglês fica como está",
  "o Luis confirmou que já sai bem. 'Consertar' aqui quebraria o nome da empresa na abertura.");
eq(comoFalar("Gui", "pt"), "Gui", "Gui em português fica como está",
  "a grafia é portuguesa: em pt ela já é lida certa. Reescrever viraria 'Ghee' na boca brasileira.");
eq(comoFalar("Lilian", "en"), "Lilian", "Lilian em inglês fica como está",
  "o inglês lê bem. Está na tabela como VERIFICADO só para ninguém 'corrigir' depois por palpite.");
eq(comoFalar("Sarah", "en"), "Sarah", "nome fora da tabela volta inalterado",
  "silêncio é o padrão seguro: fonética por adivinhação estraga nome que já estava certo.");

// ── MERCADO IMIGRANTE — é o público do produto, e é justo quem o inglês não lê ─────────────────
eq(comoFalar("João", "en"), "Zhoo-ow", "João em inglês (com acento)",
  "a chave normaliza acento; sem isso 'João' nunca casaria e o dono ouviria 'Joe-ay-oh'.");
eq(comoFalar("Jorge", "en"), "Hor-hey", "Jorge em inglês",
  "inglês lê /dʒɔrdʒ/. Numa clínica hispânica, errar o nome do dono na 1a frase custa a conta.");
eq(comoFalar("João", "pt"), "João", "João em português fica como está",
  "o par obrigatório: o conserto do inglês não pode vazar para o idioma nativo.");

// ── A FRASE INTEIRA (é isso que vai para o motor de voz) ───────────────────────────────────────
eq(frasefalada("Thank you for calling Guileo. This is Gui — how may I help you today?", "en"),
   "Thank you for calling Guileo. This is Ghee — how may I help you today?",
   "saudação real em inglês",
   "a saudação de verdade: 'Guileo' intacto E 'Gui' corrigido na MESMA frase — a prova de que a troca respeita limite de palavra e não come o nome maior.");

// ⚠️ ESTE TESTE MUDOU EM 2026-08-25, e o motivo importa mais que a linha.
// Ele afirmava que NADA muda em português — o que era verdade enquanto ninguém tinha ouvido. O Luis
// ouviu três amostras geradas com a voz real e escolheu "Guiléo": a voz é uma só (Bella) para todos
// os idiomas e aplicava fonética inglesa a uma grafia que o português leria sozinho. O acento força
// a tônica gui-LÉ-o.
// O que o teste PROTEGE continua igual e é o essencial: "Gui" NÃO vira "Ghee" em português. Trocar
// o nome da agente por grafia inglesa numa ligação brasileira é o defeito que este arquivo existe
// para impedir. Mudou o dado, não a regra.
eq(frasefalada("Obrigada por ligar para Guileo! Aqui é a Gui — em que eu posso te ajudar hoje?", "pt"),
   "Obrigada por ligar para Guiléo! Aqui é a Gui — em que eu posso te ajudar hoje?",
   "em português a MARCA ganha acento e o NOME da agente fica intacto",
   "'Guileo'→'Guiléo' (escolhido de ouvido) e 'Gui' NUNCA vira 'Ghee' em pt. Se o Gui mudar aqui, a agente brasileira passou a falar inglês macarrônico.");

eq(frasefalada("GUI aqui.", "en"), "GHEE aqui.", "caixa alta é preservada",
   "quem escreve o nome em maiúscula no cadastro não pode receber 'Ghee' no meio de um grito.");

// Um "gui" DENTRO de outra palavra não pode ser trocado — é o erro clássico de busca-e-troca.
eq(frasefalada("Follow the guide, please.", "en"), "Follow the guide, please.",
   "'gui' dentro de 'guide' NÃO é trocado",
   "sem limite de palavra, 'guide' viraria 'gheede' e a agente soaria com defeito de fala.");

const TOTAL = 12;
if (falhas) {
  console.log(`\n${falhas}/${TOTAL} errados. O nome é a PRIMEIRA palavra que o cliente ouve:`);
  console.log("   errado, ele decide nos primeiros 2 segundos que do outro lado tem uma máquina.");
  process.exit(1);
}
console.log(`✅ ${TOTAL}/${TOTAL} — nome sai certo em cada idioma, e o que já estava certo não foi tocado`);
