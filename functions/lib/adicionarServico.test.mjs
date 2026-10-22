// ADD-ON NUM AGENDAMENTO QUE JÁ EXISTE — `node functions/lib/adicionarServico.test.mjs`
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Duas partes, sem rede e sem banco:
//   A) a decisão pura (lib/adicionarServico.js): qual é o pai, quais vagas são "coladas";
//   B) o endpoint de verdade (api/agent-schedule.js, op="add_service") com o Supabase SIMULADO em
//      memória — prova que o caminho inteiro só diz "pronto" com id, grava o elo com o pai, tenta a
//      próxima vaga quando a primeira é tomada, oferece alternativas reais e não escreve em prova.
// O controle positivo de cada bloco é um caso que TEM que falhar se a regra cair.
import {
  escolherAgendamentoPai, vagasColadas, diasAte, rotuloServicos, rotuloQuando,
  addonFeitoMsg, addonSemColadoMsg, addonQualAgendamentoMsg, addonSemAgendamentoMsg,
} from "./adicionarServico.js";

let falhas = 0, total = 0;
const ok = (cond, nome, extra) => { total++; if (cond) console.log(`  ✓ ${nome}`); else { falhas++; console.log(`  ✗ ${nome}${extra !== undefined ? `\n      → ${JSON.stringify(extra).slice(0, 400)}` : ""}`); } };

// ── A) DECISÃO PURA ─────────────────────────────────────────────────────────────────────────────
console.log("A) escolherAgendamentoPai");
const M = { id: "m1", ref: "GUI-AAAA", service: "Massage 60min", pro: "Ana", location: "Astoria", start: "2026-10-20T18:00:00+00:00", status: "booked" };
const M2 = { id: "m2", ref: "GUI-BBBB", service: "Massage 60min", pro: "Ana", location: "Astoria", start: "2026-10-23T18:00:00+00:00", status: "booked" };
const H = { id: "h1", ref: "GUI-CCCC", service: "Haircut", pro: "Bia", location: "Astoria", start: "2026-10-21T15:00:00+00:00", status: "booked" };
ok(escolherAgendamentoPai([], {}).motivo === "nenhum", "sem agendamento → nenhum");
ok(escolherAgendamentoPai([M], {}).pai?.id === "m1", "um só → é ele");
ok(escolherAgendamentoPai([M, H], {}).motivo === "ambiguo", "dois sem pista → pergunta (nunca escolhe calado)");
ok(escolherAgendamentoPai([M, H], { servicoExistente: "massage" }).pai?.id === "m1", "pista pelo serviço existente");
ok(escolherAgendamentoPai([M, M2], { servicoExistente: "massage" }).motivo === "ambiguo", "duas massagens → ainda pergunta");
ok(escolherAgendamentoPai([M, M2], { appointmentId: "m2" }).pai?.id === "m2", "id manda");
ok(escolherAgendamentoPai([M, M2], { appointmentId: "zz" }).motivo === "id_nao_achado", "id de outro (ou de outro tenant) → recusa");
ok(escolherAgendamentoPai([M, M2], { ref: "gui-bbbb" }).pai?.id === "m2", "referência falada");
const F = { id: "f1", ref: "GUI-DDDD", service: "Facial", pro: "Ana", location: "Astoria", start: "2026-10-20T19:00:00+00:00", status: "booked" };
ok(escolherAgendamentoPai([M, F], { servicoNovo: "facial" }).pai?.id === "m1", "o facial que já entrou não é pai do facial (retentativa)");
ok(escolherAgendamentoPai([M, F], {}).motivo === "ambiguo", "controle: sem servicoNovo, os mesmos dois são ambíguos");

console.log("A) vagasColadas");
// pai: massagem 14:00–15:00 (UTC 18:00–19:00). Facial de 30 min.
const pai = { start: "2026-10-20T18:00:00.000Z", end: "2026-10-20T19:00:00.000Z" };
const s = (hhmm, pro, pro_id) => ({ start: `2026-10-20T${hhmm}:00.000Z`, pro, pro_id });
const grade = [s("16:00", "Ana", "a"), s("17:30", "Bia", "b"), s("18:30", "Bia", "b"), s("19:00", "Bia", "b"), s("19:00", "Ana", "a"), s("19:20", "Ana", "a"), s("21:00", "Ana", "a")];
const mesmoPro = (x) => x.pro_id === "a";
const r1 = vagasColadas(grade, pai, { duracaoMin: 30, mesmoPro });
ok(r1.coladas[0]?.start === "2026-10-20T19:00:00.000Z" && r1.coladas[0]?.pro === "Ana" && r1.coladas[0]?.posicao === "after", "1º: mesma profissional, logo depois", r1.coladas[0]);
ok(!r1.coladas.some((c) => c.start.startsWith("2026-10-20T18:30")), "nunca dentro do horário do pai (a pessoa não está em dois lugares)");
ok(r1.coladas.some((c) => c.posicao === "before" && c.start.startsWith("2026-10-20T17:30")), "antes, colado (17:30–18:00) entra");
ok(!r1.coladas.some((c) => c.start.startsWith("2026-10-20T16:00")) && r1.mesmoDia.some((c) => c.start.startsWith("2026-10-20T16:00")), "16:00 (1h30 de folga) não é colado → vira alternativa do dia");
ok(r1.coladas.findIndex((c) => c.pro === "Bia") > r1.coladas.findIndex((c) => c.pro === "Ana"), "mesma profissional antes de outra");
const r2 = vagasColadas(grade, pai, { duracaoMin: 30, mesmoPro, posicao: "before" });
ok(r2.coladas.length && r2.coladas.every((c) => c.posicao === "before"), "position=before só devolve antes", r2.coladas);
const r3 = vagasColadas(grade, pai, { duracaoMin: 30, mesmoPro, ocupados: [{ start: "2026-10-20T19:00:00.000Z", end: "2026-10-20T19:45:00.000Z" }] });
ok(!r3.coladas.some((c) => c.start.startsWith("2026-10-20T19:00") || c.start.startsWith("2026-10-20T19:20")), "outro agendamento da pessoa também bloqueia");
ok(vagasColadas(grade, pai, { duracaoMin: 0 }).coladas.length === 0, "sem duração → nada (não chuta)");
// CONTROLE POSITIVO: com folga 0, 19:20 não pode ser colado; com folga 30, pode.
ok(!vagasColadas(grade, pai, { duracaoMin: 30, folgaMaxMin: 0.001 }).coladas.some((c) => c.start.startsWith("2026-10-20T19:20")) && vagasColadas(grade, pai, { duracaoMin: 30 }).coladas.some((c) => c.start.startsWith("2026-10-20T19:20")), "controle: a folga é que decide o 'colado'");

console.log("A) rótulos e falas");
ok(diasAte("2026-10-20T18:00:00Z", Date.parse("2026-10-17T12:00:00Z")) === 5, "janela alcança o dia do pai");
const itens = [{ service: "Facial", start: "2026-10-20T19:00:00Z" }, { service: "Massage", start: "2026-10-20T18:00:00Z" }];
ok(rotuloServicos(itens) === "Massage + Facial", "comprovante: os dois serviços, na ordem do relógio");
ok(rotuloQuando(itens, (i) => `D ${i.slice(11, 16)}`, (i) => i.slice(11, 16)) === "D 18:00 (Massage) · 19:00 (Facial)", "comprovante: os dois horários");
for (const L of ["en", "pt", "es", "hi"]) {
  const frases = [addonFeitoMsg(L, { addon: "X", pai: "Y", posicao: "after", quando: "Q" }), addonSemColadoMsg(L, { addon: "X", pai: "Y", dia: "D", alts: "A" }), addonSemColadoMsg(L, { addon: "X", pai: "Y", dia: "D", alts: "" }), addonQualAgendamentoMsg(L, { addon: "X", lista: "Z" }), addonSemAgendamentoMsg(L, "X")];
  ok(frases.every((f) => f && f.includes("X")), `falas completas em ${L}`);
}
ok(addonFeitoMsg("pt", { addon: "Facial", pai: "Massagem", posicao: "after", quando: "Q" }) !== addonFeitoMsg("en", { addon: "Facial", pai: "Massagem", posicao: "after", quando: "Q" }), "pt ≠ en (não caiu no inglês)");

// ── B) O ENDPOINT, COM O SUPABASE SIMULADO ──────────────────────────────────────────────────────
console.log("B) api/agent-schedule op=add_service (Supabase em memória)");
const TENANT = "e2e-test@guileoai.com";
const IDS = { loc: "L1", ana: "P-ana", bia: "P-bia", mas: "S-mas", fac: "S-fac" };
function motor() {
  const st = {
    appts: [{ id: "PAI", ref: "GUI-PAI1", service_id: IDS.mas, pro_id: IDS.ana, location_id: IDS.loc, contact: "+19175550101", start: "2026-10-20T18:00:00.000Z", status: "booked", attributes: {} }],
    booked: [], tomarProximo: 0, chamadas: [],
  };
  const menu = {
    services: [{ id: IDS.mas, name: "Test Massage 60min", duration_min: 60, price_cents: 9000 }, { id: IDS.fac, name: "Test Facial 30min", duration_min: 30, price_cents: 5000 }],
    locations: [{ id: IDS.loc, name: "Test Location", tz: "America/New_York" }],
    professionals: [{ id: IDS.ana, name: "Teste Ana", services: [IDS.mas, IDS.fac], locations: [IDS.loc] }, { id: IDS.bia, name: "Teste Bia", services: [IDS.fac], locations: [IDS.loc] }],
  };
  const nomeSvc = (id) => menu.services.find((x) => x.id === id)?.name;
  const nomePro = (id) => menu.professionals.find((x) => x.id === id)?.name;
  const rpc = {
    biz_lookup: () => menu,
    biz_find_appointments: (b) => ({ appointments: st.appts.filter((a) => a.contact === b.p_contact && a.status !== "cancelled").map((a) => ({ id: a.id, ref: a.ref, service: nomeSvc(a.service_id), pro: nomePro(a.pro_id), location: "Test Location", start: a.start.replace(".000Z", "+00:00"), status: a.status })) }),
    biz_availability: (b) => {
      if (b.p_limit === 1) return { duration_min: 60, slots: [] };
      // grade do motor: Ana 19:00 e 19:30 (depois), Bia 17:30 (antes) e 19:00; Ana 21:00 (longe)
      const g = [["2026-10-20T17:30:00+00:00", IDS.bia], ["2026-10-20T19:00:00+00:00", IDS.ana], ["2026-10-20T19:00:00+00:00", IDS.bia], ["2026-10-20T19:30:00+00:00", IDS.ana], ["2026-10-20T21:00:00+00:00", IDS.ana]];
      return { duration_min: 30, slots: g.filter(([, p]) => !b.p_pro_id || b.p_pro_id === p).filter(([t, p]) => !st.booked.some((x) => x.p_start === t && x.p_pro_id === p)).map(([t, p]) => ({ start: t, pro_id: p, pro: nomePro(p), location_id: IDS.loc, location: "Test Location" })) };
    },
    biz_book: (b) => {
      const dup = st.booked.find((x) => x.p_request_id && x.p_request_id === b.p_request_id);
      if (dup) return { ok: true, appointment_id: dup.id, ref: dup.ref, status: "booked", idempotent: true };
      if (st.tomarProximo > 0) { st.tomarProximo--; return { ok: false, reason: "slot_taken" }; }
      const id = `ADD${st.booked.length + 1}`, ref = `GUI-AD${st.booked.length + 1}`;
      st.booked.push({ ...b, id, ref });
      st.appts.push({ id, ref, service_id: b.p_service_id, pro_id: b.p_pro_id, location_id: b.p_location_id, contact: b.p_contact, start: new Date(b.p_start).toISOString(), status: "booked", attributes: b.p_attributes });
      return { ok: true, appointment_id: id, ref, status: "booked" };
    },
  };
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const fn = (u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/) || [])[1];
    const body = init.body ? JSON.parse(init.body) : {};
    st.chamadas.push(fn || u);
    if (fn && rpc[fn]) return new Response(JSON.stringify(rpc[fn](body)), { status: 200, headers: { "Content-Type": "application/json" } });
    if (u.includes("api.resend.com")) { st.emails = (st.emails || 0) + 1; return new Response(JSON.stringify({ id: "re_x" }), { status: 200 }); }
    return new Response("null", { status: 404 });   // o resto (CRM, feed, Square…) não existe aqui
  };
  return st;
}
const { onRequestPost } = await import("../api/agent-schedule.js");
const env = { AGENT_ACTION_SECRET: "t", SCHED_SECRET: "s", INGEST_SECRET: "i" };
const chamar = async (body, headers = {}) => {
  const req = new Request("https://guileoai.com/api/agent-schedule", { method: "POST", body: JSON.stringify(body), headers: { "x-guileo-secret": "t", "x-guileo-client": TENANT, "x-guileo-test": "1", ...headers } });
  return (await onRequestPost({ request: req, env })).json();
};

{
  const st = motor();
  const r = await chamar({ op: "add_service", service: "facial", contact: "+19175550101", name: "Maria", lang: "en" });
  ok(r.ok === true && r.appointment_id === "ADD1" && r.parent_appointment_id === "PAI", "reserva o facial e devolve o id + o pai", r);
  ok(r.start === "2026-10-20T19:00:00.000Z" && r.position === "after" && r.same_professional === true && r.pro === "Teste Ana", "logo depois, com a mesma profissional", r);
  ok(st.booked[0]?.p_attributes?.parent_appointment_id === "PAI" && st.booked[0]?.p_attributes?.add_on === true, "o elo com o pai foi gravado em attributes", st.booked[0]?.p_attributes);
  ok(st.booked[0]?.p_request_id === `addon:PAI:${IDS.fac}`, "idempotente pelo pai + serviço");
  ok(st.booked[0]?.p_contact === "+19175550101", "mesmo contato do pai (aparece no `find` junto)");
  ok(/added Test Facial 30min right after your Test Massage 60min/.test(r.message || ""), "a frase diz o que foi feito", r.message);
  ok(!st.emails, "modo teste (x-guileo-test) não manda e-mail");
  // retentativa da ElevenLabs: mesma chamada → mesma reserva, nada novo
  const r2 = await chamar({ op: "add_service", service: "facial", contact: "+19175550101", name: "Maria", lang: "en" });
  ok(r2.ok === true && r2.appointment_id === "ADD1" && st.booked.length === 1, "retentativa devolve a MESMA reserva (não duplica)", r2);
  const r3 = await chamar({ op: "add_service", service: "facial", contact: "+19175550101", position: "before", lang: "en" });
  ok(r3.appointment_id === "ADD1" && r3.position === "after" && /right after/.test(r3.message), "retentativa com outra posição: a frase descreve a reserva REAL (depois), não o candidato", r3);
}
{
  const st = motor(); st.tomarProximo = 1;
  const r = await chamar({ op: "add_service", service: "facial", contact: "+19175550101", lang: "pt" });
  ok(r.ok === true && r.pro === "Teste Ana" && r.start === "2026-10-20T19:30:00.000Z", "horário tomado na hora → próxima colada, ainda com a mesma profissional", r);
}
{
  const st = motor(); st.tomarProximo = 2;
  const r = await chamar({ op: "add_service", service: "facial", contact: "+19175550101", lang: "pt" });
  ok(r.ok === true && r.pro === "Teste Bia" && r.same_professional === false && r.start === "2026-10-20T19:00:00.000Z", "mesma profissional sem vaga → outra profissional qualificada", r);
  ok(/^Pronto — Test Facial 30min adicionado logo depois/.test(r.message || ""), "fala em português", r.message);
}
{
  const st = motor();
  const r = await chamar({ op: "add_service", service: "facial", contact: "+19175550101", position: "before", dry_run: true });
  ok(r.ok === true && r.dry_run === true && r.decision?.slot === "2026-10-20T17:30:00+00:00" && r.decision?.position === "before", "dry_run decide (antes, 17:30) e não reserva", r);
  ok(st.booked.length === 0 && !st.chamadas.includes("biz_book"), "dry_run: nenhuma chamada a biz_book");
}
{
  const st = motor();
  st.booked.push({ p_start: "2026-10-20T17:30:00+00:00", p_pro_id: IDS.bia }, { p_start: "2026-10-20T19:00:00+00:00", p_pro_id: IDS.bia }, { p_start: "2026-10-20T19:00:00+00:00", p_pro_id: IDS.ana }, { p_start: "2026-10-20T19:30:00+00:00", p_pro_id: IDS.ana });
  const n0 = st.booked.length;
  const r = await chamar({ op: "add_service", service: "facial", contact: "+19175550101", lang: "en" });
  ok(r.ok === false && r.reason === "sem_vaga_colada" && r.alternatives?.[0]?.start === "2026-10-20T21:00:00+00:00", "sem colada → alternativa REAL do mesmo dia, sem reservar", r);
  ok(!r.appointment_id && st.booked.length === n0, "nunca 'ok' sem id");
  const r2 = await chamar({ op: "add_service", service: "facial", contact: "+19175550101", when: "2026-10-20T21:00:00Z", lang: "en" });
  ok(r2.ok === true && r2.start === "2026-10-20T21:00:00.000Z" && st.booked.at(-1)?.p_attributes?.parent_appointment_id === "PAI", "a pessoa escolhe a alternativa → reserva, ainda ligada ao pai", r2);
}
{
  motor();
  const r = await chamar({ op: "add_service", service: "facial", contact: "+19990000000", lang: "en" });
  ok(r.ok === false && r.reason === "sem_agendamento", "contato sem agendamento → oferece marcar como novo", r);
  const r2 = await chamar({ op: "add_service", service: "facial", contact: "+19175550101", appointment_id: "DE-OUTRO", lang: "en" });
  ok(r2.ok === false && r2.reason === "qual_agendamento", "id que não é desta pessoa → não usa", r2);
}
{
  // BINA: a agente mandou o placeholder; o número de quem liga vem no cabeçalho.
  const st = motor();
  const r = await chamar({ op: "add_service", service: "facial", contact: "caller_phone", lang: "en" }, { "x-guileo-caller": "+19175550101" });
  ok(r.ok === true && st.booked.length === 1, "acha o pai pelo BINA quando o contato veio quebrado", r);
}

console.log(`\n${falhas ? "❌" : "✅"} ${total - falhas}/${total} passaram`);
process.exit(falhas ? 1 : 0);
