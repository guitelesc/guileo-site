// Teste do relógio do MindBody. Roda com: node functions/lib/mindbodyTempo.test.mjs
//
// POR QUE EXISTE: o MindBody devolve "2026-07-15T09:00:00" — hora NA PAREDE do spa, sem fuso.
// O código antigo fazia Date.parse disso num Worker (UTC) e a agente falava o horário 4 horas
// errado no verão e 5 no inverno. Este teste prende a conversão nos dois sentidos, nas duas
// viradas de horário de verão de Nova York em 2026 (8 de março e 1º de novembro), e prende a
// expansão de JANELA em horários reserváveis.
//
// CADA BLOCO TEM UM "PLANTADO": um caso que só passa se a lógica certa estiver lá. Se alguém
// trocar a conversão por Date.parse, ou ignorar o BookableEndDateTime, é ele que acusa.
import {
  localParaInstante, instanteParaLocal, expandirJanelas, casarInstante, horariosAtivos,
  somarMinutosLocais, diaLocal, partesLocais, mesmoMinutoLocal, zonaValida,
} from "./mindbodyTempo.js";

const NY = "America/New_York";
const falhas = [];
let n = 0;
const igual = (obtido, esperado, nome) => { n++; if (JSON.stringify(obtido) !== JSON.stringify(esperado)) falhas.push(`${nome}\n     esperado: ${JSON.stringify(esperado)}\n     obtido:   ${JSON.stringify(obtido)}`); };
const iso = (s, tz = NY) => { const r = localParaInstante(s, tz); return r.ok ? r.iso : `FALHA:${r.motivo}`; };

// ── 1. hora de parede → instante ────────────────────────────────────────────────────────────
igual(iso("2026-07-15T09:00:00"), "2026-07-15T13:00:00.000Z", "verão: 9h em NY = 13h UTC (EDT, −4)");
igual(iso("2026-01-15T09:00:00"), "2026-01-15T14:00:00.000Z", "inverno: 9h em NY = 14h UTC (EST, −5)");
igual(iso("2026-07-15T09:00:00", "America/Sao_Paulo"), "2026-07-15T12:00:00.000Z", "outro fuso: 9h em São Paulo = 12h UTC");
igual(iso("2026-07-15T09:00:00.000Z"), "2026-07-15T13:00:00.000Z", "designador Z é ignorado: a doc diz que o valor é SEMPRE hora local do negócio");
// PLANTADO: o defeito antigo. Se a conversão virar Date.parse (UTC), este caso acusa.
n++; if (iso("2026-07-15T09:00:00") === new Date(Date.parse("2026-07-15T09:00:00Z")).toISOString()) falhas.push("PLANTADO: a hora local foi lida como UTC — é o defeito que este arquivo existe para impedir");

// março — o relógio pula de 02:00 para 03:00 em 8/3/2026
igual(iso("2026-03-07T09:00:00"), "2026-03-07T14:00:00.000Z", "véspera da virada de março ainda é −5");
igual(iso("2026-03-08T09:00:00"), "2026-03-08T13:00:00.000Z", "dia da virada de março, 9h já é −4");
igual(iso("2026-03-08T01:30:00"), "2026-03-08T06:30:00.000Z", "01:30 de 8/3 ainda é −5");
igual(iso("2026-03-08T03:00:00"), "2026-03-08T07:00:00.000Z", "03:00 de 8/3 já é −4");
igual(localParaInstante("2026-03-08T02:30:00", NY), { ok: false, motivo: "hora_inexistente" }, "PLANTADO março: 02:30 de 8/3 NÃO EXISTE — tem que recusar, não inventar 07:30Z");

// novembro — o relógio volta de 02:00 para 01:00 em 1/11/2026
igual(iso("2026-10-31T09:00:00"), "2026-10-31T13:00:00.000Z", "véspera da virada de novembro ainda é −4");
igual(iso("2026-11-01T09:00:00"), "2026-11-01T14:00:00.000Z", "dia da virada de novembro, 9h já é −5");
igual(iso("2026-11-01T00:30:00"), "2026-11-01T04:30:00.000Z", "00:30 de 1/11 ainda é −4");
igual(iso("2026-11-01T02:00:00"), "2026-11-01T07:00:00.000Z", "02:00 de 1/11 já é −5");
{
  const r = localParaInstante("2026-11-01T01:30:00", NY);
  igual({ ok: r.ok, iso: r.iso, ambiguo: r.ambiguo }, { ok: true, iso: "2026-11-01T05:30:00.000Z", ambiguo: true }, "PLANTADO novembro: 01:30 de 1/11 existe DUAS vezes — fica a primeira e avisa que é ambíguo");
}
igual(localParaInstante("amanhã às 10", NY).ok, false, "texto falado não é data");
igual(localParaInstante("2026-02-31T09:00:00", NY).ok, false, "31 de fevereiro não existe");
igual(localParaInstante("2026-07-15T09:00:00", "Nova_York/Errado"), { ok: false, motivo: "fuso" }, "fuso inválido é recusado, não vira UTC");

// ── 2. instante → hora de parede (o que vai para o MindBody) ────────────────────────────────
igual(instanteParaLocal("2026-07-15T13:00:00Z", NY), "2026-07-15T09:00:00", "verão: volta para 9h");
igual(instanteParaLocal("2026-01-15T14:00:00Z", NY), "2026-01-15T09:00:00", "inverno: volta para 9h");
igual(instanteParaLocal("2026-07-16T03:30:00Z", NY), "2026-07-15T23:30:00", "o DIA também muda: 03:30Z é 23:30 do dia anterior");
igual(instanteParaLocal("2026-07-16T04:00:00Z", NY), "2026-07-16T00:00:00", "meia-noite sai 00:00, nunca 24:00");
igual(diaLocal("2026-07-16T02:00:00Z", NY), "2026-07-15", "diaLocal: a data da busca é a do SITE, não a UTC");
// PLANTADO: ida e volta nas duas viradas tem que fechar
for (const s of ["2026-03-08T03:30:00", "2026-03-08T12:00:00", "2026-11-01T03:00:00", "2026-11-01T12:00:00", "2026-07-04T16:45:00"]) {
  igual(instanteParaLocal(localParaInstante(s, NY).ms, NY), s, `PLANTADO ida-e-volta: ${s}`);
}
igual(somarMinutosLocais("2026-07-15T23:30:00", 60), "2026-07-16T00:30:00", "soma na parede vira o dia");
igual(mesmoMinutoLocal("2026-07-15T09:00:00", "2026-07-15T09:00:30.000"), true, "mesmo minuto local");
igual(mesmoMinutoLocal("2026-07-15T09:00:00", "2026-07-15T09:01:00"), false, "minuto diferente");
igual(partesLocais("2026-07-15")?.h, 0, "data sem hora = 00:00");
igual(zonaValida("America/New_York") && !zonaValida("Eastern Standard Time") && !zonaValida(""), true, "só nome IANA é fuso");

// ── 3. janelas → inícios reserváveis ────────────────────────────────────────────────────────
// Forma de GET /appointment/bookableitems (OpenAPI: Availability).
const janela = (extra = {}) => ({
  Id: 1, Staff: { Id: 100012, FirstName: "Ana", LastName: "Souza", DisplayName: "Ana" },
  SessionType: { Id: 11, Name: "Facial", DefaultTimeLength: 60, StaffTimeLength: null },
  Location: { Id: 1, Name: "Astoria" },
  StartDateTime: "2026-07-15T09:00:00", EndDateTime: "2026-07-15T12:00:00", BookableEndDateTime: "2026-07-15T11:00:00",
  ...extra,
});
const horas = (r) => r.slots.map((s) => s.local.slice(11, 16));
{
  const r = expandirJanelas([janela()], { tz: NY, passoMin: 30 });
  igual(horas(r), ["09:00", "09:30", "10:00", "10:30", "11:00"], "janela 9–12, sessão de 60, último início 11:00 (inclusivo)");
  igual(r.slots[0].start, "2026-07-15T13:00:00.000Z", "o início sai como INSTANTE real (13:00Z), não como 09:00Z");
  igual([r.slots[0].staff_id, r.slots[0].mb_location_id, r.slots[0].session_type_id, r.slots[0].pro, r.slots[0].location], [100012, 1, 11, "Ana", "Astoria"], "profissional e unidade vêm de DENTRO de Staff/Location (objetos aninhados)");
}
igual(horas(expandirJanelas([janela({ BookableEndDateTime: "2026-07-15T10:00:00" })], { tz: NY, passoMin: 30 })), ["09:00", "09:30", "10:00"], "PLANTADO: BookableEndDateTime manda — 10:30 e 11:00 NÃO podem aparecer");
igual(horas(expandirJanelas([janela({ BookableEndDateTime: null })], { tz: NY, passoMin: 30 })), ["09:00", "09:30", "10:00", "10:30", "11:00"], "sem BookableEndDateTime: último início = fim − duração");
igual(horas(expandirJanelas([janela({ BookableEndDateTime: null, SessionType: { Id: 11, DefaultTimeLength: 90 } })], { tz: NY, passoMin: 30 })), ["09:00", "09:30", "10:00", "10:30"], "PLANTADO: sessão de 90 não pode começar 11:00 numa janela que fecha 12:00");
igual(horas(expandirJanelas([janela({ BookableEndDateTime: "0001-01-01T10:30:00" })], { tz: NY, passoMin: 30 })), ["09:00", "09:30", "10:00", "10:30"], "BookableEndDateTime só com hora-do-dia (data-base) vale como hora do dia da janela");
igual(horas(expandirJanelas([janela({ SessionType: { Id: 11, DefaultTimeLength: 60, StaffTimeLength: 45 }, BookableEndDateTime: null })], { tz: NY, passoMin: 15 })).slice(-1), ["11:15"], "duração POR PROFISSIONAL (StaffTimeLength) vence a padrão");
{
  const ativos = horariosAtivos(["09:00:00", "10:00:00", "11:00:00", "12:00:00", "lixo"]);
  igual([ativos.minutos.size, ativos.ilegiveis], [4, 1], "horários ativos: 4 lidos, 1 ilegível contado");
  igual(horas(expandirJanelas([janela()], { tz: NY, passoMin: 30, minutosAtivos: ativos.minutos })), ["09:00", "10:00", "11:00"], "PLANTADO: com horários ativos do site, 09:30 e 10:30 NÃO são oferecidos");
  igual([...horariosAtivos(["9:30", "0001-01-01T14:15:00", "2:00 PM"]).minutos].sort((a, b) => a - b), [570, 840, 855], "horários ativos em três formatos");
}
{
  const r = expandirJanelas([janela({ StartDateTime: "2026-07-15T09:00:00", EndDateTime: "2026-07-15T09:30:00", BookableEndDateTime: null })], { tz: NY });
  igual([r.ok, r.slots.length, r.descartadas], [true, 0, 0], "janela menor que a sessão: zero horários, e isso NÃO é erro");
}
{
  const r = expandirJanelas([janela({ StartDateTime: "quando der" }), janela({ Staff: null }), janela()], { tz: NY, passoMin: 60 });
  igual([r.slots.length, r.descartadas], [3, 2], "PLANTADO: janela ilegível é CONTADA como descartada, nunca vira horário");
}
{
  const outra = janela({ Staff: { Id: 100099, FirstName: "Bia", LastName: "Lima" }, StartDateTime: "2026-07-15T10:00:00", BookableEndDateTime: "2026-07-15T10:00:00" });
  const r = expandirJanelas([janela({ BookableEndDateTime: "2026-07-15T10:00:00" }), outra, janela({ BookableEndDateTime: "2026-07-15T10:00:00" })], { tz: NY, passoMin: 60 });
  igual(r.slots.map((s) => `${s.local.slice(11, 16)}/${s.staff_id}`), ["09:00/100012", "10:00/100012", "10:00/100099"], "duas profissionais no mesmo horário aparecem as duas; janela repetida não duplica");
  igual(r.slots[2].pro, "Bia Lima", "sem DisplayName o nome é FirstName + LastName");
}
{
  const agora = Date.parse("2026-07-15T14:10:00Z");   // 10:10 em NY
  igual(horas(expandirJanelas([janela()], { tz: NY, passoMin: 30, agoraMs: agora, antecedenciaMin: 30 })), ["11:00"], "PLANTADO: horário que já passou (ou está a menos de 30 min) não é oferecido");
}
{
  // dia da virada de março: a janela 01:00–04:00 tem um buraco das 02:00 às 02:59
  const r = expandirJanelas([janela({ StartDateTime: "2026-03-08T01:00:00", EndDateTime: "2026-03-08T05:00:00", BookableEndDateTime: "2026-03-08T04:00:00" })], { tz: NY, passoMin: 30 });
  igual(horas(r), ["01:00", "01:30", "03:00", "03:30", "04:00"], "PLANTADO: no dia da virada, 02:00 e 02:30 (que não existem) não são oferecidos");
}
igual(expandirJanelas([janela()], { tz: "" }), { ok: false, motivo: "fuso" }, "sem fuso não há horário: falha, nunca UTC por omissão");
igual(expandirJanelas(null, { tz: NY }).ok, false, "resposta que não é lista é falha, não 'sem horário'");

// ── 4. casar um instante pedido com um início disponível ────────────────────────────────────
{
  const { slots } = expandirJanelas([janela()], { tz: NY, passoMin: 30 });
  igual(casarInstante("2026-07-15T13:30:00Z", slots)?.local, "2026-07-15T09:30:00", "instante com Z casa com o início certo");
  igual(casarInstante("2026-07-15T09:30:00-04:00", slots)?.local, "2026-07-15T09:30:00", "instante com offset casa");
  igual(casarInstante("2026-07-15T13:40:00Z", slots), null, "PLANTADO: 09:40 não existe — devolve null, nunca 'o mais perto'");
  igual(casarInstante("2026-07-15T09:30:00", slots), null, "PLANTADO: hora de parede SEM fuso não é instante — recusa (Date.parse leria como UTC)");
  igual(casarInstante("amanhã às 9", slots), null, "fala não é instante");
  igual(casarInstante("2026-07-15T13:30:00Z", []), null, "lista vazia → null");
}

for (const f of falhas) console.log(`❌ ${f}`);
console.log(falhas.length ? `\n${falhas.length} de ${n} caso(s) falharam — o horário do MindBody está saindo errado` : `✅ mindbodyTempo · ${n} casos · hora local ↔ instante (viradas de março e novembro), janelas → inícios, casamento exato`);
if (falhas.length) process.exit(1);
