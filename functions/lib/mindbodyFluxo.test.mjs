// Teste do FLUXO MindBody pelo roteador (scheduleAdapter). Roda com: node functions/lib/mindbodyFluxo.test.mjs
//
// Os outros três testes prendem as peças (relógio, mapa, cliente da API). Este prende a COLA —
// que é onde moravam os defeitos da revisão:
//   (a) a fala ("tomorrow at 10") ia crua para o MindBody e para o espelho;
//   (b) UUID da Guileo ia como LocationId/StaffId;
//   (e) erro do MindBody virava horário do motor interno.
// `fetch` é um dublê: o Supabase (RPCs) e o MindBody respondem com formas documentadas. Nada sai
// para a rede. Credenciais abaixo são inventadas.
import { resolveScheduler, getAvailability, book, cancel, mirrorOf, rescheduleOptions, reschedule, falaAgendaExterna } from "./scheduleAdapter.js";
import { resolveSlot } from "./slotResolver.js";
import { instanteParaLocal, localParaInstante, diaLocal } from "./mindbodyTempo.js";
import { _limparCacheDeTeste } from "./mindbodyApi.js";

const falhas = [];
let n = 0;
const igual = (obtido, esperado, nome) => { n++; if (JSON.stringify(obtido) !== JSON.stringify(esperado)) falhas.push(`${nome}\n     esperado: ${JSON.stringify(esperado)}\n     obtido:   ${JSON.stringify(obtido)}`); };
const certo = (cond, nome) => { n++; if (!cond) falhas.push(nome); };

const NY = "America/New_York";
const EMAIL = "spa@exemplo.com";
const SENHA = "senha-inventada-fluxo-5521";
const S1 = "00000000-0000-4000-8000-000000000011", S9 = "00000000-0000-4000-8000-000000000099";
const L1 = "00000000-0000-4000-8000-000000000001", P1 = "00000000-0000-4000-8000-000000000021";
const APPT = "00000000-0000-4000-8000-0000000000aa";
const env = { MINDBODY_API_KEY: "chave-inventada-fluxo", INGEST_SECRET: "ingest-inventado", SUPABASE_SERVICE_ROLE: "service-inventado" };
const AMANHA = diaLocal(Date.now() + 864e5, NY);          // "amanhã" no relógio do SITE
const credsOk = { site_id: "767008", site_ids: ["767008", "5734109"], source_name: "staff.teste", source_password: SENHA };
const mapaOk = { v: 2, ativo: true, sites: { "767008": { nome: "Astoria", tz: NY }, "5734109": { nome: "UES", tz: NY } },
  services: { [S1]: { site_id: "767008", session_type_id: 11, location_id: 1, nome: "Facial" } },
  locations: { [L1]: { site_id: "767008", location_id: 1, nome: "Astoria" } }, staff: { [P1]: { site_id: "767008", staff_id: 100012, nome: "Ana Souza" } } };

const resposta = (status, corpo) => new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
let rpcs = [], mb = [], cenario = {};
function montar(c) {
  _limparCacheDeTeste(); rpcs = []; mb = []; cenario = c;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const corpo = init.body ? JSON.parse(init.body) : null;
    if (u.hostname.endsWith("supabase.co")) {
      const fn = u.pathname.split("/").pop();
      rpcs.push({ fn, corpo, chave: (init.headers || {}).apikey });
      const r = (c.rpc || {})[fn];
      if (r === undefined) return resposta(200, true);          // ex.: ingest_client_event do alarme
      return typeof r === "function" ? r(corpo) : r.clone();     // Response só pode ser lida uma vez
    }
    const caminho = u.pathname.replace("/public/v6", "");
    mb.push({ metodo: init.method || "GET", caminho, q: u.searchParams, headers: init.headers || {}, corpo, url: String(url) });
    const rota = (c.mb || {})[`${init.method || "GET"} ${caminho}`];
    if (!rota) return resposta(404, { Error: { Message: "rota não prevista", Code: "Unknown" } });
    return rota({ q: u.searchParams, corpo, headers: init.headers || {} });
  };
}
const pag = (chave, itens) => resposta(200, { PaginationResponse: { RequestedLimit: 200, RequestedOffset: 0, PageSize: itens.length, TotalResults: itens.length }, [chave]: itens });
const token = () => resposta(200, { TokenType: "Bearer", AccessToken: "tok-fluxo", Expires: new Date(Date.now() + 864e5).toISOString().replace("Z", "") });
const janela = { Id: 1, Staff: { Id: 100012, FirstName: "Ana", LastName: "Souza", DisplayName: "Ana" }, SessionType: { Id: 11, Name: "Facial", DefaultTimeLength: 60 }, Location: { Id: 1, Name: "Astoria" },
  StartDateTime: `${AMANHA}T09:00:00`, EndDateTime: `${AMANHA}T12:00:00`, BookableEndDateTime: `${AMANHA}T11:00:00` };
const mbNormal = () => ({
  "POST /usertoken/issue": token,
  "GET /appointment/bookableitems": () => pag("Availabilities", [janela]),
  "GET /appointment/activesessiontimes": () => pag("ActiveSessionTimes", ["09:00:00", "10:00:00", "11:00:00"]),
});
const config = (creds = credsOk, mapping = mapaOk) => resposta(200, { creds, mapping, synced_at: null });

// ═══ 1. quem é o dono da agenda ═══════════════════════════════════════════════════════════════
montar({ rpc: { mb_config: config() } });
{
  const r = await resolveScheduler(env, EMAIL);
  igual([r.provider, r.ready, r.reason], ["mindbody", true, "mindbody-connected"], "chave + login + mapa ativo → MindBody é o dono da agenda");
  igual(rpcs[0].chave, "service-inventado", "a leitura de credenciais usa o service_role (anon não executa mais)");
}
montar({ rpc: { mb_config: config(credsOk, { ...mapaOk, ativo: false }) } });
igual((({ provider, reason }) => [provider, reason])(await resolveScheduler(env, EMAIL)), ["internal", "mindbody-sem-mapa"], "conectado SEM mapa salvo → continua no motor interno (meia configuração não desliga o que funciona)");
montar({ rpc: { mb_config: config({ site_id: "767008", source_name: "", source_password: "" }) } });
igual((await resolveScheduler(env, EMAIL)).reason, "mindbody-sem-credencial", "site sem login → interno, com o motivo escrito");
montar({ rpc: { mb_config: resposta(200, { creds: null, mapping: null }) } });
igual((await resolveScheduler(env, EMAIL)).provider, "internal", "tenant sem MindBody → interno");
montar({ rpc: { mb_config: resposta(404, { code: "PGRST202", message: "Could not find the function" }) } });
igual((await resolveScheduler(env, EMAIL)).provider, "internal", "SQL ainda não aplicado → ninguém tem MindBody → interno");
montar({ rpc: { mb_config: resposta(401, { message: "permission denied" }) } });
{
  // Quem NUNCA foi visto com o MindBody ativo não perde a agenda por uma leitura que falhou.
  const semUso = await resolveScheduler({ ...env, RATE_LIMIT: { get: async () => null, put: async () => {} } }, EMAIL);
  igual([semUso.provider, semUso.ready, semUso.reason], ["internal", true, "mindbody-config-ilegivel-sem-uso-conhecido"], "leitura falhou e o negócio nunca usou MindBody → segue no motor interno");
  const semKv = await resolveScheduler({ ...env, RATE_LIMIT: undefined }, EMAIL);
  igual(semKv.provider, "internal", "leitura falhou e não há memória nenhuma → motor interno");
}
{
  // Quem ESTAVA com o MindBody ativo na última leitura boa: falha fechada.
  const r = await resolveScheduler({ ...env, RATE_LIMIT: { get: async () => "1", put: async () => {} } }, EMAIL);
  igual([r.provider, r.ready, r.reason], ["mindbody", false, "mindbody-config-ilegivel"], "PLANTADO: não deu para LER a configuração → NÃO cai no interno às cegas; falha fechada com motivo");
  const av = await getAvailability(env, EMAIL, r, { service_id: S1, tz: NY });
  igual([av.handled, av.ok, av.reason], [true, false, "mindbody-config-ilegivel"], "…e a disponibilidade responde falha (handled:true), não 'use o interno'");
}
igual((await resolveScheduler({ ...env, MINDBODY_API_KEY: "" }, EMAIL)).provider, "internal", "sem chave da plataforma o conector é inerte");

// ═══ 2. disponibilidade: horários reais, no fuso do site, com ids do MAPA ═════════════════════
const sc = { provider: "mindbody", ready: true, creds: credsOk, mapping: mapaOk, reason: "mindbody-connected" };
montar({ mb: mbNormal() });
const av = await getAvailability(env, EMAIL, sc, { service_id: S1, location_id: L1, professional_id: P1, tz: "America/Sao_Paulo" });
{
  igual([av.handled, av.ok, av.tz, av.grade], [true, true, NY, "horarios_do_site"], "disponibilidade ok, no fuso do SITE (não no da unidade da Guileo passada como reserva)");
  igual(av.slots.map((s) => s.local.slice(11, 16)), ["09:00", "10:00", "11:00"], "a janela 9–12 virou 3 inícios (horários ativos do site)");
  igual(av.slots[0].start, localParaInstante(`${AMANHA}T09:00:00`, NY).iso, "PLANTADO: 9h locais é o instante certo em UTC — não 09:00Z");
  const ch = mb.find((c) => c.caminho === "/appointment/bookableitems");
  igual([ch.headers.SiteId, ch.q.getAll("request.sessionTypeIds"), ch.q.getAll("request.locationIds"), ch.q.getAll("request.staffIds")], ["767008", ["11"], ["1"], ["100012"]], "ids do MindBody vêm do MAPA, no site certo");
  certo(!mb.some((c) => /[0-9a-f]{8}-[0-9a-f]{4}-4/.test(c.url)), "PLANTADO: nenhum UUID da Guileo aparece em chamada ao MindBody");
  igual([av.slots[0].staff_id, av.slots[0].mb_location_id, av.slots[0].site_id], [100012, 1, "767008"], "cada início carrega profissional, unidade e site do próprio MindBody");
}
// PLANTADO (e): MindBody fora → falha com motivo; NUNCA handled:false (que faria o chamador usar o motor interno)
montar({ mb: { ...mbNormal(), "GET /appointment/bookableitems": () => resposta(500, { Error: { Message: "down", Code: "Unknown" } }) } });
{
  const r = await getAvailability(env, EMAIL, sc, { service_id: S1, tz: NY });
  igual([r.handled, r.ok, r.reason, r.slots], [true, false, "mindbody_fora", undefined], "PLANTADO: MindBody fora do ar → { handled:true, ok:false, reason } — sem lista de horários, sem queda para o interno");
}
montar({ mb: { ...mbNormal(), "POST /usertoken/issue": () => resposta(403, { Error: { Message: "denied", Code: "InvalidLoginCredentials" } }) } });
igual((({ handled, ok, reason }) => [handled, ok, reason])(await getAvailability(env, EMAIL, sc, { service_id: S1, tz: NY })), [true, false, "login_recusado"], "login recusado → falha com motivo");
montar({ mb: { ...mbNormal(), "GET /appointment/bookableitems": () => pag("Availabilities", []) } });
igual((({ ok, slots }) => [ok, slots.length])(await getAvailability(env, EMAIL, sc, { service_id: S1, tz: NY })), [true, 0], "MindBody respondeu e não há janela → AÍ sim é 'sem horário' (ok:true, 0 slots)");
montar({ mb: { ...mbNormal(), "GET /appointment/activesessiontimes": () => resposta(500, "x") } });
{
  const r = await getAvailability(env, EMAIL, sc, { service_id: S1, tz: NY });
  igual([r.ok, r.grade, r.slots.length], [true, "passo_reserva", 5], "horários ativos indisponíveis → segue com as janelas, de 30 em 30 min, e DIZ que usou a grade reserva");
}
montar({ mb: mbNormal() });
igual((({ handled, ok, reason }) => [handled, ok, reason])(await getAvailability(env, EMAIL, sc, { service_id: S9, tz: NY })), [true, false, "servico_sem_par"], "PLANTADO: serviço fora do mapa → falha 'servico_sem_par' — não adivinha sessão, não cai no interno");
igual((await getAvailability(env, EMAIL, { ...sc, creds: { ...credsOk, site_ids: ["5734109"], site_id: "5734109" } }, { service_id: S1, tz: NY })).reason, "site_nao_conectado", "mapa apontando para site que o tenant não conectou → recusa");
igual(mb.length, 0, "…e nenhuma chamada saiu para o MindBody nesses dois casos");

// ═══ 3. agendar: a fala é resolvida contra a disponibilidade; o que vai é hora LOCAL ══════════
const cliente = { Id: "200", FirstName: "Luis", LastName: "T", MobilePhone: "(929) 535-0191", Email: null, Active: true };
let criados = [];
const mbBook = () => ({
  ...mbNormal(),
  "GET /client/clients": ({ q }) => pag("Clients", q.getAll("request.clientIDs").length ? [cliente] : []),
  "GET /appointment/staffappointments": () => pag("Appointments", criados),
  "POST /appointment/addappointment": ({ corpo }) => { const a = { Id: 900, Status: "Booked", StartDateTime: corpo.StartDateTime, EndDateTime: `${AMANHA}T11:00:00`, Duration: 60, ClientId: corpo.ClientId, SessionTypeId: corpo.SessionTypeId, StaffId: corpo.StaffId, LocationId: corpo.LocationId }; criados = [a]; return resposta(200, { Appointment: a }); },
});
montar({ mb: mbBook(), rpc: { mb_client_ids: resposta(200, ["200"]), mb_mirror_upsert: resposta(200, { ok: true, id: APPT, novo: true }), mb_client_put: resposta(200, { ok: true }) } });
criados = [];
{
  const slot = resolveSlot("tomorrow at 10", av.slots, av.tz);
  igual(slot && slot.local, `${AMANHA}T10:00:00`, "'tomorrow at 10' resolve para as 10h LOCAIS de amanhã, dentro da disponibilidade real");
  const r = await book(env, EMAIL, sc, { slot, service_id: S1, location_id: L1, professional_id: P1, tz: NY, name: "Louise", contact: "+19295350191", request_id: "conv-1" });
  igual([r.handled, r.ok, r.external_ref, r.ref_falado, r.appointment_id, r.start, r.espelho], [true, true, "767008:900", "900", APPT, localParaInstante(`${AMANHA}T10:00:00`, NY).iso, true], "agendado: referência site:id, número falado curto, instante real");
  const add = mb.find((c) => c.caminho === "/appointment/addappointment").corpo;
  igual([add.StartDateTime, add.ClientId, add.LocationId, add.StaffId, add.SessionTypeId, add.StaffRequested], [`${AMANHA}T10:00:00`, "200", 1, 100012, 11, true], "PLANTADO (a)+(b): o MindBody recebe hora local de parede e ids numéricos — nem a fala, nem UUID");
  const esp = rpcs.find((x) => x.fn === "mb_mirror_upsert").corpo;
  igual([esp.p_start, esp.p_end, esp.p_external_ref, esp.p_service_id, esp.p_location_id], [localParaInstante(`${AMANHA}T10:00:00`, NY).iso, localParaInstante(`${AMANHA}T11:00:00`, NY).iso, "767008:900", S1, L1], "PLANTADO (a): o espelho grava o INSTANTE real (com fim confirmado pelo MindBody), não o texto falado");
  igual(instanteParaLocal(esp.p_start, NY), `${AMANHA}T10:00:00`, "…e o instante do espelho, lido no fuso do site, é 10:00");
  igual(esp.p_attributes.mb, { site_id: "767008", appointment_id: 900, client_id: "200", session_type_id: 11, staff_id: 100012, location_id: 1, tz: NY }, "o espelho guarda onde o agendamento mora no MindBody (para cancelar/remarcar)");
  igual(mb.filter((c) => c.caminho === "/client/addclient").length, 0, "cliente achado pelo telefone (índice local conferido no MindBody) — nome mal-ouvido 'Louise' não criou duplicata");
  certo(!JSON.stringify(r).includes(SENHA) && !rpcs.some((x) => JSON.stringify(x.corpo).includes(SENHA)), "PLANTADO: a senha não aparece no resultado nem em nenhuma RPC do fluxo de agendamento");

  // a ElevenLabs re-tenta a ferramenta → mesmo agendamento, sem segundo POST
  const r2 = await book(env, EMAIL, sc, { slot, service_id: S1, location_id: L1, professional_id: P1, tz: NY, name: "Louise", contact: "+19295350191", request_id: "conv-1" });
  igual([r2.ok, r2.external_ref, r2.reutilizado, mb.filter((c) => c.caminho === "/appointment/addappointment").length], [true, "767008:900", true, 1], "PLANTADO: a ferramenta re-tentada devolve o MESMO agendamento — 1 POST no total");
}
{
  // slot que não veio do MindBody (fala crua) é recusado antes de qualquer chamada
  montar({ mb: mbBook(), rpc: {} });
  const r = await book(env, EMAIL, sc, { slot: { local: "tomorrow at 10", staff_id: 100012 }, service_id: S1, tz: NY, name: "X", contact: "+19295350191" });
  igual([r.handled, r.ok, r.reason, mb.length], [true, false, "horario_nao_resolvido", 0], "PLANTADO (a): 'tomorrow at 10' como slot → recusado, zero chamadas ao MindBody");
}
{
  // MindBody recusa o horário → a agente oferece outro (não 'a recepção confirma')
  montar({ mb: { ...mbBook(), "POST /appointment/addappointment": () => resposta(400, { Error: { Message: "not a valid booking time", Code: "InvalidBookingTime" } }) }, rpc: { mb_client_ids: resposta(200, ["200"]) } });
  criados = [];
  const r = await book(env, EMAIL, sc, { slot: av.slots[1], service_id: S1, tz: NY, name: "Louise", contact: "+19295350191", request_id: "conv-2" });
  igual([r.handled, r.ok, r.reason, r.horario_tomado, r.etapa], [true, false, "horario_indisponivel", true, "agendamento"], "horário recusado pelo MindBody → horario_tomado");
  certo(!rpcs.some((x) => x.fn === "mb_mirror_upsert"), "PLANTADO: agendamento que falhou NÃO gera espelho");
}
{
  // espelho não gravou: o agendamento vale (existe no MindBody), e a falha vira alarme
  montar({ mb: mbBook(), rpc: { mb_client_ids: resposta(200, ["200"]), mb_mirror_upsert: resposta(500, "boom") } });
  criados = [];
  const r = await book(env, EMAIL, sc, { slot: av.slots[2], service_id: S1, tz: NY, name: "Louise", contact: "+19295350191", request_id: "conv-3" });
  igual([r.ok, r.espelho, r.appointment_id], [true, false, null], "espelho falhou → o resultado DIZ (espelho:false), não finge");
}

// ═══ 4. cancelar e remarcar chegam ao MindBody ════════════════════════════════════════════════
const espelho = { ok: true, found: true, id: APPT, source: "mindbody", external_ref: "767008:900", service_id: S1, location_id: L1, status: "booked", start: localParaInstante(`${AMANHA}T10:00:00`, NY).iso, end: localParaInstante(`${AMANHA}T11:00:00`, NY).iso, customer_name: "Louise", customer_contact: "+19295350191", attributes: { staff_pedido: false, mb: { site_id: "767008", appointment_id: 900, session_type_id: 11, staff_id: 100012, location_id: 1, tz: NY } } };
montar({ mb: { ...mbNormal(), "POST /appointment/updateappointment": () => resposta(200, { Appointment: { Id: 900, Status: "Cancelled" } }) }, rpc: { mb_mirror_get: resposta(200, espelho) } });
{
  const r = await cancel(env, EMAIL, sc, { appointment_id: APPT });
  const ch = mb.find((c) => c.caminho === "/appointment/updateappointment");
  igual([r.handled, r.ok, ch.headers.SiteId, ch.corpo], [true, true, "767008", { AppointmentId: 900, Execute: "cancel" }], "PLANTADO (g): cancelar um espelho cancela NO MindBody, no site certo");
  igual(rpcs[0].corpo, { p_secret: "ingest-inventado", p_email: EMAIL, p_appointment_id: APPT }, "o espelho é buscado pelo tenant + id (id sozinho não autoriza)");
}
montar({ mb: mbNormal(), rpc: { mb_mirror_get: resposta(200, { ok: true, found: true, id: APPT, source: "gui", external_ref: null }) } });
igual([(await cancel(env, EMAIL, sc, { appointment_id: APPT })).handled, mb.length], [false, 0], "agendamento do motor interno → handled:false (o interno cancela), MindBody nem é chamado");
montar({ mb: mbNormal(), rpc: { mb_mirror_get: resposta(200, { ok: true, found: false }) } });
igual((await cancel(env, EMAIL, sc, { appointment_id: APPT })).handled, false, "agendamento de OUTRO tenant não é achado → nada acontece no MindBody");
montar({ mb: mbNormal(), rpc: { mb_mirror_get: resposta(500, "x") } });
igual((({ handled, ok, reason }) => [handled, ok, reason])(await cancel(env, EMAIL, sc, { appointment_id: APPT })), [true, false, "espelho_ilegivel"], "PLANTADO: não deu para saber se é espelho → falha (não cancela só o lado de cá)");
montar({ mb: { ...mbNormal(), "POST /appointment/updateappointment": () => resposta(500, "x") }, rpc: { mb_mirror_get: resposta(200, espelho) } });
igual((({ handled, ok, reason }) => [handled, ok, reason])(await cancel(env, EMAIL, sc, { appointment_id: APPT })), [true, false, "mindbody_fora"], "MindBody não cancelou → handled:true, ok:false — quem chama NÃO cancela o espelho");

montar({ mb: { ...mbNormal(), "POST /appointment/updateappointment": ({ corpo }) => resposta(200, { Appointment: { Id: 900, Status: "Booked", StartDateTime: corpo.StartDateTime, EndDateTime: `${AMANHA}T12:00:00`, Duration: 60 } }) }, rpc: { mb_mirror_get: resposta(200, espelho), mb_mirror_upsert: resposta(200, { ok: true, id: APPT, novo: false }) } });
{
  const m = await mirrorOf(env, EMAIL, sc, APPT);
  const op = await rescheduleOptions(env, EMAIL, sc, { mirror: m.mirror, tz: NY });
  const ch = mb.find((c) => c.caminho === "/appointment/bookableitems");
  igual([op.ok, ch.q.get("request.appointmentId"), ch.q.getAll("request.sessionTypeIds"), ch.q.getAll("request.staffIds")], [true, "900", ["11"], []], "remarcar: disponibilidade da MESMA sessão, ignorando o próprio agendamento (request.appointmentId); sem travar profissional que ninguém pediu");
  const slot = resolveSlot("tomorrow at 11", op.slots, op.tz);
  const r = await reschedule(env, EMAIL, sc, { mirror: m.mirror, slot: { ...slot, tz: op.tz }, tz: op.tz });
  const up = mb.find((c) => c.caminho === "/appointment/updateappointment").corpo;
  igual([r.ok, up, r.start], [true, { AppointmentId: 900, StartDateTime: `${AMANHA}T11:00:00` }, localParaInstante(`${AMANHA}T11:00:00`, NY).iso], "PLANTADO (g): remarcar move NO MindBody com hora local, e devolve o instante real");
  igual(rpcs.find((x) => x.fn === "mb_mirror_upsert").corpo.p_start, localParaInstante(`${AMANHA}T11:00:00`, NY).iso, "…e o espelho acompanha");
}

// ═══ 5. o que a agente fala quando a agenda externa não responde ══════════════════════════════
certo(/calendar/i.test(falaAgendaExterna("nao_vejo", "en")) && /agenda/i.test(falaAgendaExterna("nao_vejo", "pt-BR")) && /agenda/i.test(falaAgendaExterna("nao_vejo", "es")), "a frase existe em en/pt/es e fala da agenda");
certo(!/front desk will confirm|recepção confirma/i.test(falaAgendaExterna("nao_vejo", "en") + falaAgendaExterna("nao_vejo", "pt")), "PLANTADO: a frase não promete que 'a recepção confirma' um horário que ninguém viu");

for (const f of falhas) console.log(`❌ ${f}`);
console.log(falhas.length ? `\n${falhas.length} de ${n} caso(s) falharam — o fluxo MindBody do roteador está errado` : `✅ mindbodyFluxo · ${n} casos · fala resolvida na agenda real, ids do mapa, erro do MindBody nunca vira horário interno, cancelar/remarcar chegam lá`);
if (falhas.length) process.exit(1);
