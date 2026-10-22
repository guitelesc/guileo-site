// CR-01 + CR-02 — `node functions/lib/provisionDisclosure.test.mjs`
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CR-01 (contrato Natura, vale pra toda agente): no início de toda ligação/conversa, ANTES de pedir
// qualquer coisa, a agente se apresenta como ASSISTENTE VIRTUAL do negócio e, na ligação, avisa que
// pode ser gravada. Nunca diz ser humana. O que continua proibido é o bastidor (plataforma/modelo/
// provedor). Três peças: a tabela GREETINGS (provision.js), a constituição e o filtro de saída
// (guiConstitution.js), e a 1ª mensagem do webchat (public/gui-widget.js).
// CR-02: a ferramenta `schedule` passa a oferecer find/reschedule/cancel (o servidor já atendia) —
// esquema + instrução + o endpoint de verdade com o Supabase SIMULADO em memória.
// Sem rede, sem banco. Cada bloco tem um CONTROLE POSITIVO: um caso que TEM que falhar se a regra cair.
import { readFileSync } from "node:fs";
import {
  GREETINGS, buildGuiPrompt, buildLanguagePresets, buildConversationConfig, LANGS_SPOKEN,
  SCHEDULE_OPS, GERENCIAR_AGENDAMENTO,
} from "./provision.js";
import { constitutionFor, validateOutput } from "./guiConstitution.js";
import { conferePadrao, ANUNCIO_VIRTUAL, ANUNCIO_GRAVACAO } from "./padraoAgente.js";
import { variantesDoContato } from "./contato.js";

let falhas = 0, total = 0;
const ok = (cond, nome, extra) => { total++; if (cond) console.log(`  ✓ ${nome}`); else { falhas++; console.log(`  ✗ ${nome}${extra !== undefined ? `\n      → ${JSON.stringify(extra).slice(0, 400)}` : ""}`); } };

// "Anunciou direito" = assistente virtual + gravação + o negócio + quem fala, e NENHUMA frase de gente.
const anuncia = (frase, biz, nome) => ANUNCIO_VIRTUAL.test(frase) && ANUNCIO_GRAVACAO.test(frase)
  && frase.includes(biz) && frase.includes(nome)
  && !validateOutput(frase, { asBusiness: true, business: biz }).flags.some((f) => f.code === "human_claim");

// ── A) A TABELA DE SAUDAÇÕES ────────────────────────────────────────────────────────────────────
console.log("A) GREETINGS — todo idioma anuncia assistente virtual + gravação");
const BIZ = "Spa Teste", NOME = "Lilian";
const idiomas = Object.keys(GREETINGS);
ok(idiomas.length >= 16, `a tabela cobre ${idiomas.length} idiomas`, idiomas);
for (const L of idiomas) {
  const f = GREETINGS[L].replace(/\{biz\}/g, BIZ).replace(/\{name\}/g, NOME);
  ok(anuncia(f, BIZ, NOME), `${L}: anuncia (virtual + gravação + negócio + nome), sem dizer que é gente`, f);
  ok(!/\{\{/.test(GREETINGS[L]), `${L}: sem {{variável}} na 1ª fala (derruba a ligação)`);
  ok(f.length <= 240, `${L}: curta (${f.length} chars)`);
}
for (const L of ["en", "pt", "es"]) ok(/take care of you|cuidar de você|cuidarle/i.test(GREETINGS[L]), `${L}: mantém a saudação de CUIDADO (item 1 da norma)`);
// cada idioma que a agente FALA sai anunciando: os com saudação própria e os que herdam
const presets = buildLanguagePresets("en", { business: BIZ, agentName: NOME });
for (const { code } of LANGS_SPOKEN) {
  if (code === "en") continue;
  const k = code === "pt" ? "pt-br" : code;
  const fm = presets[k]?.overrides?.agent?.first_message;
  if (GREETINGS[code]) ok(fm && ANUNCIO_VIRTUAL.test(fm) && ANUNCIO_GRAVACAO.test(fm), `preset ${k}: 1ª fala anuncia`, fm);
}
for (const L of ["en", "pt", "es"]) {
  const { firstMessage } = buildGuiPrompt({ business: BIZ, lang: L, agentName: NOME });
  ok(ANUNCIO_VIRTUAL.test(firstMessage) && ANUNCIO_GRAVACAO.test(firstMessage), `buildGuiPrompt(${L}).firstMessage anuncia`, firstMessage);
}
// a norma do agente (varredura) enxerga a regra — e reprova a saudação antiga
const normaCom = (fm) => conferePadrao({ conversation_config: { agent: { first_message: fm } } }).itens.find((i) => /assistente virtual/.test(i.item));
ok(normaCom(GREETINGS.en.replace(/\{biz\}/g, BIZ).replace(/\{name\}/g, NOME))?.ok === true, "norma: saudação nova passa no item 'assistente virtual + gravação'");
// CONTROLE POSITIVO: a saudação de ANTES do CR-01 tem que reprovar — em tudo.
const ANTIGA = "Thank you for calling Spa Teste, this is Lilian. How can I take care of you today?";
ok(!anuncia(ANTIGA, BIZ, NOME) && normaCom(ANTIGA)?.ok === false, "controle: a saudação antiga (sem anúncio) REPROVA no teste e na norma");
ok(!anuncia("Thank you for calling Spa Teste! I'm Lilian, a real person — this call may be recorded, virtual tour available.", BIZ, NOME), "controle: 'virtual' + 'recorded' mas dizendo que é gente REPROVA");

// ── B) A CONSTITUIÇÃO E O FILTRO ────────────────────────────────────────────────────────────────
console.log("B) constituição + filtro de saída");
const voz = constitutionFor({ business: "Natura Spa", audience: "public", asBusiness: true });
ok(/IDENTITY: You are Natura Spa's virtual assistant/.test(voz), "voz do negócio: 'You are X's virtual assistant'");
ok(/At the very start of every conversation/.test(voz) && /may be recorded/.test(voz), "voz do negócio: apresenta no início, menciona a gravação na ligação");
ok(/Never claim, imply or agree that you are a human being/.test(voz), "voz do negócio: nunca diz ser humana");
ok(!/Never say you are an AI/i.test(voz), "a regra antiga ('Never say you are an AI') saiu");
ok(/Never name the platform, the AI model, the voice provider/.test(voz) && !/guileo/i.test(voz), "bastidor continua proibido — e a regra não diz o nome que proíbe");
const review = constitutionFor({ business: "Natura Spa", audience: "public", asBusiness: true, channel: "review" });
ok(!/At the very start of every conversation/.test(review) && /Never claim, imply or agree that you are a human/.test(review), "review: sem apresentação de abertura, mas nunca 'sou gente'");
ok(/IDENTITY: You are a virtual assistant \(Guileo's\)/.test(constitutionFor({ audience: "public" })), "concierge da landing também é assistente virtual");

const V = (t, o = {}) => validateOutput(t, { asBusiness: true, business: "Natura Spa", ...o }).flags.map((f) => f.code);
const permitido = [
  "Hi! I'm Lilian, Natura Spa's virtual assistant — this call may be recorded. How can I take care of you today?",
  "Oi! Sou a Lilian, assistente virtual da Natura Spa. Como posso te ajudar?",
  "¡Hola! Soy Lilian, la asistente virtual de Natura Spa.",
  "Good question — I'm the spa's virtual assistant, an AI. Want me to connect you with someone from the team?",
  "Não sou uma pessoa, sou a assistente virtual da Natura Spa — quer que eu chame alguém da equipe?",
  "No soy humana, soy la asistente virtual de Natura Spa.",
];
for (const t of permitido) ok(V(t).length === 0, `permitido: ${t.slice(0, 60)}…`, V(t));
const humano = [
  "I'm a real person, don't worry!", "I am human.", "I'm not a robot, I promise.", "You're speaking with a real person.",
  "Sou humana, pode ficar tranquila.", "Não sou um robô!", "Você está falando com uma pessoa de verdade.",
  "Soy una persona real.", "No soy un robot.", "Está hablando con una persona de verdad.",
];
for (const t of humano) ok(V(t).includes("human_claim"), `marcado human_claim: ${t}`, V(t));
ok(validateOutput("I'm a real person", { audience: "public" }).flags.some((f) => f.code === "human_claim"), "human_claim vale em toda superfície (não só voz do negócio)");
for (const t of ["I'm powered by ElevenLabs.", "I'm a large language model.", "I run on ChatGPT.", "Thanks for calling — Guileo here."]) ok(V(t).includes("identity_leak"), `bastidor marcado: ${t}`, V(t));
ok(validateOutput("Welcome to Guileo — I'm Guileo's virtual assistant.", { asBusiness: true, business: "Guileo" }).flags.length === 0, "tenant Guileo pode dizer o próprio nome");
ok(V("As an AI, I appreciate your feedback.", { channel: "review" }).includes("identity_leak") && V("As an AI, I appreciate your feedback.").length === 0, "falar de IA: só marcado em resposta pública de review");
// CONTROLE POSITIVO: as frases de gente passam LIMPAS se o filtro de human_claim cair (prova que é ele quem marca).
ok(humano.every((t) => !V(t).includes("identity_leak")), "controle: frase de gente não é confundida com bastidor (código próprio)");

// ── C) A FERRAMENTA `schedule` ──────────────────────────────────────────────────────────────────
console.log("C) ferramenta schedule — find/reschedule/cancel");
const cfg = buildConversationConfig({ AGENT_ACTION_SECRET: "x" }, { business: BIZ, lang: "en", email: "e2e-test@guileoai.com", agentName: NOME });
const tool = (cfg.agent?.prompt?.tools || []).find((t) => t.name === "schedule");
const props = tool?.api_schema?.request_body_schema?.properties || {};
ok(!!tool, "a ferramenta schedule existe");
for (const op of ["find", "reschedule", "cancel"]) ok(props.op?.enum?.includes(op) && props.op?.description?.includes(op) && tool.description.includes(`op='${op}'`), `op='${op}' no enum, na descrição do campo e na da ferramenta`);
ok(JSON.stringify(props.op?.enum) === JSON.stringify(SCHEDULE_OPS) && SCHEDULE_OPS.length === 8, "enum = SCHEDULE_OPS (8 ops)");
ok(["appointment_id", "ref", "when", "contact"].every((k) => props[k]?.type === "string" && props[k]?.description), "campos appointment_id · ref · when · contact declarados");
ok(/op='reschedule'/.test(props.when.description) && /op='find'/.test(props.appointment_id.description), "when = o NOVO horário; appointment_id vem do find");
ok(tool.api_schema.request_headers["x-guileo-client"] === "e2e-test@guileoai.com" && !props.client_email, "tenant continua preso no cabeçalho (a LLM não escolhe o negócio)");
const fonte = readFileSync(new URL("../api/agent-schedule.js", import.meta.url), "utf8");
for (const op of SCHEDULE_OPS) ok(fonte.includes(`op === "${op}"`), `o servidor atende op='${op}'`);
const prompt = cfg.agent?.prompt?.prompt || "";
ok(prompt.includes(GERENCIAR_AGENDAMENTO), "a instrução de remarcar/cancelar entra no prompt");
ok(/FIND first/.test(GERENCIAR_AGENDAMENTO) && /READ IT BACK/.test(GERENCIAR_AGENDAMENTO) && /ONLY after an explicit yes/.test(GERENCIAR_AGENDAMENTO) && /never waive/.test(GERENCIAR_AGENDAMENTO) && /ONLY when the result has ok=true/.test(GERENCIAR_AGENDAMENTO), "ordem: achar → ler de volta → confirmar → política → só diz feito com ok=true");
ok(!/\{\{/.test(cfg.agent?.first_message || ""), "1ª fala do agente montado continua sem variável");

// ── D) WEBCHAT ──────────────────────────────────────────────────────────────────────────────────
console.log("D) webchat — 1ª mensagem");
const widget = readFileSync(new URL("../../public/gui-widget.js", import.meta.url), "utf8");
const greets = [...widget.matchAll(/greet: "([^"]+)"/g)].map((m) => m[1]);
ok(greets.length === 3, "três idiomas no widget", greets);
for (const g of greets) ok(/virtual/i.test(g) && !ANUNCIO_GRAVACAO.test(g), `chat anuncia assistente virtual (sem aviso de gravação): ${g.slice(0, 50)}…`);

// ── E) O ENDPOINT, COM O SUPABASE SIMULADO ──────────────────────────────────────────────────────
console.log("E) api/agent-schedule find → reschedule → cancel (Supabase em memória)");
const TENANT = "e2e-test@guileoai.com";
const st = {
  appts: [
    { id: "A1", ref: "GUI-AAA1", service_id: "S1", contact: "+19175550101", start: "2026-10-20T18:00:00+00:00", status: "booked" },
    { id: "A2", ref: "GUI-AAA2", service_id: "S1", contact: "+19175550101", start: "2026-10-22T18:00:00+00:00", status: "booked" },
    { id: "X9", ref: "GUI-XXX9", service_id: "S1", contact: "+19175559999", start: "2026-10-21T18:00:00+00:00", status: "booked" },
  ],
  canceladas: [], movidas: [], emails: 0,
};
const menu = { services: [{ id: "S1", name: "Test Massage 60min", duration_min: 60, price_cents: 9000 }], locations: [{ id: "L1", name: "Test Location", tz: "America/New_York" }], professionals: [] };
const rpcs = {
  biz_lookup: () => menu,
  biz_find_appointments: (b) => ({ appointments: st.appts.filter((a) => a.contact === b.p_contact && a.status !== "cancelled").map((a) => ({ id: a.id, ref: a.ref, service: "Test Massage 60min", pro: null, location: "Test Location", start: a.start, status: a.status })) }),
  biz_availability: () => ({ duration_min: 60, slots: [{ start: "2026-10-23T19:00:00+00:00" }, { start: "2026-10-24T15:00:00+00:00" }] }),
  biz_reschedule: (b) => { const a = st.appts.find((x) => x.id === b.p_appointment_id); if (!a) return { ok: false, reason: "not_found" }; a.start = b.p_new_start; st.movidas.push(b.p_appointment_id); return { ok: true }; },
  biz_cancel: (b) => { const a = st.appts.find((x) => x.id === b.p_appointment_id); if (!a) return { ok: false }; a.status = "cancelled"; st.canceladas.push(b.p_appointment_id); return { ok: true }; },
};
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const fn = (u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/) || [])[1];
  const body = init.body ? JSON.parse(init.body) : {};
  if (fn && rpcs[fn]) return new Response(JSON.stringify(rpcs[fn](body)), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.includes("api.resend.com")) { st.emails++; return new Response(JSON.stringify({ id: "re_x" }), { status: 200 }); }
  return new Response("null", { status: 404 });
};
const { onRequestPost } = await import("../api/agent-schedule.js");
const env = { AGENT_ACTION_SECRET: "t", SCHED_SECRET: "s", INGEST_SECRET: "i" };
const chamar = async (body, headers = {}) => {
  const req = new Request("https://guileoai.com/api/agent-schedule", { method: "POST", body: JSON.stringify(body), headers: { "x-guileo-secret": "t", "x-guileo-client": TENANT, "x-guileo-test": "1", ...headers } });
  return (await onRequestPost({ request: req, env })).json();
};
{
  // a agente mandou o NOME da variável — o BINA do cabeçalho entra no lugar
  const f = await chamar({ op: "find", contact: "{{caller_phone}}", lang: "en" }, { "x-guileo-caller": "+19175550101" });
  ok(f.appointments?.length === 2 && f.appointments.every((a) => a.id !== "X9"), "find pelo BINA: só os agendamentos de QUEM LIGA", f);
  ok(/Test Massage 60min/.test(f.message || ""), "find lê de volta o serviço", f.message);
  const f2 = await chamar({ op: "find", contact: "+19175559999", lang: "en" }, { "x-guileo-caller": "+19175550101" });
  ok(f2.appointments?.length === 1 && f2.appointments[0].id === "X9", "telefone DITADO vence o BINA (agendamento no número de outra pessoa da casa)", f2);
  // reschedule pela referência falada: só casa dentro dos agendamentos do contato
  const r = await chamar({ op: "reschedule", ref: "gui-aaa2", when: "2026-10-23T19:00:00Z", lang: "en" }, { "x-guileo-caller": "+19175550101" });
  ok(r.ok === true && st.movidas.at(-1) === "A2" && st.appts.find((a) => a.id === "A2").start === "2026-10-23T19:00:00+00:00", "reschedule pelo ref → move A2 para um horário REAL da agenda", r);
  const rx = await chamar({ op: "reschedule", ref: "GUI-XXX9", when: "2026-10-24T15:00:00Z", lang: "en" }, { "x-guileo-caller": "+19175550101" });
  ok(rx.ok !== true && !st.movidas.includes("X9"), "ref de OUTRA pessoa não abre o agendamento dela", rx);
  // cancel com o id que o find devolveu
  const c = await chamar({ op: "cancel", appointment_id: "A1", lang: "pt" }, { "x-guileo-caller": "+19175550101" });
  ok(c.ok === true && st.canceladas.includes("A1") && /cancelado/i.test(c.message || ""), "cancel com appointment_id → cancelado, fala em pt", c);
  ok(st.emails === 0, "modo teste (x-guileo-test) não manda e-mail");
  // A SIMULAÇÃO DE 08/10: a agente mandou o MESMO número com espaços e o find voltou vazio 3×.
  const fe = await chamar({ op: "find", contact: "+1 917 555 0101", lang: "en" });
  ok(fe.appointments?.length === 1 && fe.appointments[0].id === "A2", "find com o número formatado ('+1 917 555 0101') acha o agendamento gravado como '+19175550101'", fe);
  const f10 = await chamar({ op: "find", contact: "(917) 555-0101", lang: "en" });
  ok(f10.appointments?.length === 1, "find com 10 dígitos e pontuação também acha", f10);
  const ff = await chamar({ op: "find", contact: "the number they are calling from", lang: "en" }, { "x-guileo-caller": "+19175550101" });
  ok(ff.appointments?.length === 1, "frase no lugar do número → usa o BINA", ff);
  ok(JSON.stringify(variantesDoContato("nine one seven five five five zero one zero one")).includes("+19175550101") && variantesDoContato("call me").length === 0, "variantesDoContato: número falado vira +1…; frase sem número não vira contato");
  // CONTROLE POSITIVO: sem contato nenhum (nem BINA) o servidor NÃO adivinha — pergunta o telefone.
  const n0 = st.canceladas.length;
  const c2 = await chamar({ op: "cancel", lang: "en" });
  ok(c2.ok !== true && st.canceladas.length === n0 && /phone number/i.test(c2.message || ""), "controle: sem contato e sem id → não cancela nada, pergunta o telefone", c2);
}

console.log(`\n${total - falhas}/${total} ${falhas ? "✗ FALHOU" : "✓ tudo certo"}`);
if (falhas) process.exit(1);
