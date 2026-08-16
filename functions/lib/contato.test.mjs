// GUARDA DO CONTATO — se o telefone não chama de volta, o agendamento não vale nada.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// O PRIMEIRO agendamento real da plataforma (GUI-42F0, 2026-08-16) foi gravado com
// `customer_contact: "929-535-191"` — nove dígitos. O número real é 929-535-0191. A agente pegou
// de ouvido e perdeu um zero. O horário ficou reservado e o spa não consegue chamar de volta.
//
// Um telefone quase-certo é PIOR que nenhum: sem telefone alguém percebe e corre atrás; com um
// quase-certo a recepção disca, ouve "número inexistente", e conclui que foi trote.
//
// O RISCO DESTE TESTE é o oposto do óbvio: uma regra dura demais ("10 dígitos") derrubaria todo
// número brasileiro e todo cliente imigrante — que é exatamente o mercado da Guileo. Por isso
// metade dos casos abaixo existe para provar o que NÃO pode ser recusado.
import { avaliarContato } from "./contato.js";

let falhas = 0;
// [entrada, esperado_ok, o que este caso protege]
const CASOS = [
  // ── O CASO REAL. Se este voltar a passar, o defeito voltou.
  ["929-535-191", false, "GUI-42F0: nove dígitos, o zero perdido de ouvido"],
  ["+1 929 535 019", false, "internacional curto demais também não chama"],

  // ── NORTE-AMERICANO VÁLIDO — a forma que 100% dos clientes de hoje usam.
  ["9295350191", true, "dez dígitos crus"],
  ["929-535-0191", true, "dez dígitos com traços"],
  ["(929) 535-0191", true, "formato falado/copiado do celular"],
  ["+1 929 535 0191", true, "com prefixo do país"],
  ["19295350191", true, "onze dígitos começando com 1"],

  // ── INTERNACIONAL — ESTES NÃO PODEM SER RECUSADOS. A plataforma é PT/ES/EN/HI e o público é
  //    imigrante; uma regra "tem que ter 10" mata o cliente brasileiro no primeiro contato.
  ["+55 11 98765-4321", true, "celular de São Paulo (13 dígitos)"],
  ["+351 912 345 678", true, "Portugal"],
  ["+52 55 1234 5678", true, "México"],
  ["+91 98765 43210", true, "Índia"],

  // ── E-MAIL — ditado em voz alta erra muito; só dá para checar a forma.
  ["luistelesc@gmail.com", true, "e-mail bom"],
  ["luis@gmail", false, "sem domínio de topo"],
  ["luis.gmail.com", false, "sem arroba — vira telefone de 0 dígitos se não checar"],

  // ── VAZIO nunca é sucesso silencioso.
  ["", false, "nada capturado"],
  [null, false, "null"],
];

for (const [entrada, esperado, porque] of CASOS) {
  const r = avaliarContato(entrada);
  if (r.ok !== esperado) {
    falhas++;
    console.log(`❌ ${JSON.stringify(entrada)} — esperado ok=${esperado}, obtido ok=${r.ok} (${r.motivo || r.tipo})`);
    console.log(`     protege: ${porque}`);
  }
}

if (falhas) {
  console.log(`\n${falhas}/${CASOS.length} errados. As duas falhas possíveis aqui têm donos diferentes:`);
  console.log("   deixar passar um número quebrado -> o NEGÓCIO perde o cliente que já tinha fechado;");
  console.log("   recusar um número estrangeiro bom -> a GUILEO perde o cliente imigrante na porta.");
  process.exit(1);
}
console.log(`✅ ${CASOS.length}/${CASOS.length} — contato quebrado é pego, e número internacional legítimo passa`);
