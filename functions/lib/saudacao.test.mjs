// A SAUDAÇÃO COM O NOME — o que entra na boca da agente na primeira frase da ligação.
// Errar aqui é errar na frente do cliente, na primeira palavra. "" = não mexer na saudação.
import { saudacaoComNome, ehLaco } from "../api/twilio-inbound.js";

let falhas = 0;
// [fala-base, nome no CRM, idioma do agente, esperado, o que protege]
const CASOS = [
  ["Thank you for calling Natura Spa + Salon, this is Lilian. How can I take care of you today?", "Luis Teles", "en",
   "Hi Luis! Thank you for calling Natura Spa + Salon, this is Lilian. How can I take care of you today?", "o nome na PRIMEIRA palavra (no fim, o Luis falava por cima antes de ouvir)"],
  ["Natura, aqui é a Lilian — que bom que você ligou! Como posso cuidar de você hoje?", "Ana", "pt-br", "Oi Ana! Natura, aqui é a Lilian — que bom que você ligou! Como posso cuidar de você hoje?", "português (pt-br da ElevenLabs)"],
  ["Gracias por llamar.", "María", "es", "Hola María! Gracias por llamar.", "espanhol com acento no nome"],
  ["Hello", "Maria-Clara", "ja", "Hi Maria-Clara! Hello", "idioma sem saudação própria cai no inglês"],
  ["How can I help {{caller_ola}}?", "Luis", "en", "", "fala com variável não se toca (derrubou ligação em 16 e 18/08)"],
  ["How can I help?", "", "en", "", "sem nome, sem mudança"],
  ["How can I help?", "929-535-0191", "en", "", "telefone gravado no lugar do nome"],
  ["How can I help?", "Luis (TEST)", "en", "Hi Luis! How can I help?", "só o primeiro nome entra"],
  ["How can I help?", "x", "en", "", "nome de uma letra"],
  ["How can I help?", "luis@gmail.com", "en", "", "e-mail gravado no lugar do nome"],
  ["This is Lilian. How can I help?", "Lilian", "en", "", "cliente com o nome da agente: não repetir"],
  ["", "Luis", "en", "", "agente sem saudação lida"],
];
for (const [fala, nome, lang, esperado, porque] of CASOS) {
  const r = saudacaoComNome(fala, nome, lang);
  if (r !== esperado) { falhas++; console.log(`❌ ${JSON.stringify(nome)} → ${JSON.stringify(r)} (esperado ${JSON.stringify(esperado)}) — ${porque}`); }
}
// A agente ligando para si mesma (transferência que volta pelo encaminhamento da linha).
const LACO = [
  ["+19298288170", "+19298288170", true, "mesmo número dos dois lados"],
  ["9298288170", "+19298288170", true, "o +1 some num dos lados"],
  ["+19295350191", "+19298288170", false, "cliente de verdade"],
  ["", "+19298288170", false, "sem quem liga não é laço"],
  ["+5511999990000", "+19298288170", false, "outro país"],
  ["anonymous", "+19298288170", false, "número oculto"],
];
for (const [de, para, esperado, porque] of LACO) {
  if (ehLaco(de, para) !== esperado) { falhas++; console.log(`❌ laço ${de} → ${para} (esperado ${esperado}) — ${porque}`); }
}
if (falhas) { console.log(`\n${falhas}/${CASOS.length} errados.`); process.exit(1); }
console.log(`✅ ${CASOS.length}/${CASOS.length} — a saudação só muda quando o nome é nome`);
