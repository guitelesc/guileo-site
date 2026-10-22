// TRAVA DE DESTINO — para onde a Gui pode discar.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// Entre 03 e 09/09/2026 robôs preencheram os formulários do site com números de Israel (+972 2…)
// e o speed-to-lead discou: 717 ligações, 522 minutos, US$189. A Twilio zerou, SUSPENDEU a conta,
// e o telefone de TODOS os clientes caiu junto (erro 401 "Authenticate" na ElevenLabs).
//
// As duas falhas possíveis têm donos diferentes:
//   deixar passar um destino caro  -> a GUILEO paga a fraude e todo cliente fica mudo;
//   recusar um número bom          -> o lead dos EUA ou do Brasil nunca recebe a ligação.
import { destinoPermitido, paraE164, contatoDaLigacao } from "./contato.js";

let falhas = 0;
// [entrada bruta, extraCsv, esperado_ok, o que protege]
const CASOS = [
  // ── O ATAQUE REAL. Se algum destes voltar a passar, a porta reabriu.
  ["+97222783181", "", false, "exit-intent de 03/09 (adam2640@nexora.com)"],
  ["+97222998422", "", false, "live-call de 05/09 (Byron Cummerata)"],
  ["+212600000000", "", false, "Marrocos, floating de 03/09"],
  ["+447700900000", "", false, "Reino Unido, live-call de 09/09"],
  ["+5491100000000", "", false, "Argentina, 08/09"],
  // ── DENTRO DO +1, MAS INTERNACIONAL OU PREMIUM — o mesmo golpe com cara de doméstico.
  ["+18765551234", "", false, "Jamaica (876)"],
  ["+18095551234", "", false, "República Dominicana (809)"],
  ["+12845551234", "", false, "Ilhas Virgens Britânicas (284)"],
  ["+19005551234", "", false, "900 tarifa premium"],
  // ── O MERCADO — nada disto pode ser recusado.
  ["9295350191", "", true, "EUA sem DDI (paraE164 põe +1)"],
  ["+1 986 444 3334", "", true, "a linha de demo"],
  ["+1 416 555 0199", "", true, "Canadá (Toronto)"],
  ["+1 787 555 0199", "", true, "Porto Rico é doméstico"],
  ["+55 11 98765 4321", "", true, "celular de São Paulo"],
  ["+55 21 3456 7890", "", true, "fixo do Rio"],
  // ── MERCADO NOVO LIGA POR ENV, SEM DEPLOY.
  ["+447700900000", "+44,+351", true, "CALL_DDI_EXTRA libera o Reino Unido"],
  ["+97222783181", "+44", false, "liberar +44 não libera +972"],
  ["+97222783181", "+9", false, "prefixo de 1 dígito é ignorado (+9 cobriria +972)"],
  ["", "", false, "vazio"],
];

for (const [entrada, extra, esperado, porque] of CASOS) {
  const r = destinoPermitido(paraE164(entrada), extra);
  if (r.ok !== esperado) {
    falhas++;
    console.log(`❌ ${JSON.stringify(entrada)} extra=${JSON.stringify(extra)} — esperado ok=${esperado}, obtido ok=${r.ok} (${r.motivo || "-"})`);
    console.log(`     protege: ${porque}`);
  }
}

// ── CONTATO DA LIGAÇÃO: o BINA vence o telefone ditado (GUI-439D gravou 535→525).
// [ditado, bina, contato esperado, ditado esperado nas notas]
const LIG = [
  ["929-525-0191", "+19295350191", "+19295350191", "929-525-0191"],
  ["nine two nine five three five zero one nine one", "+19295350191", "+19295350191", ""],
  ["a@b.com", "+19295350191", "a@b.com", ""],
  ["9295350191", "{{system__caller_id}}", "9295350191", ""],
  ["caller_phone", "+19295350191", "+19295350191", ""],
  ["", "", "", ""],
];
for (const [dito, bina, cEsp, dEsp] of LIG) {
  const r = contatoDaLigacao(dito, bina);
  if (r.contato !== cEsp || r.ditado !== dEsp) { falhas++; console.log(`❌ ligação ${JSON.stringify(dito)} / ${bina} → ${JSON.stringify(r)}`); }
}

if (falhas) {
  console.log(`\n${falhas}/${CASOS.length + LIG.length} errados.`);
  process.exit(1);
}
console.log(`✅ ${CASOS.length}/${CASOS.length} — destino caro é barrado, EUA/Canadá/Brasil passam`);
