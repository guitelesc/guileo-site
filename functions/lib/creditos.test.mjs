// GUARDA DO MEDIDOR DE CRÉDITO DOS CANAIS. Roda com:  node functions/lib/creditos.test.mjs
// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUE DEFEITO REAL ESTE TESTE IMPEDE
//   1. cobrar o cliente POR MENSAGEM de chat em vez de por conversa (12 mensagens = 24 créditos);
//   2. cobrar duas vezes quando o provedor reentrega o webhook;
//   3. o medidor cair e levar a RESPOSTA junto (contabilidade derrubando atendimento);
//   4. o cliente pagar pela sonda do canário, que fala com o widget dele a cada 15 minutos;
//   5. um preço redigitado aqui divergir da tabela que o cliente vê na calculadora;
//   6. ligar por engano antes da migração e cobrar em dobro com o medidor escondido do banco.
// Sem rede: `fetch` é trocado por um espião. Nenhuma chamada sai deste processo.
import { debitar, debitarDepois, custoDe, refChat, refMensagem, ehSonda } from "./creditos.js";
import { CREDIT_COST } from "../../src/data/productSystem.js";

let falhas = 0;
const ok = (cond, oque, detalhe = "") => {
  if (cond) return;
  falhas++;
  console.log(`❌ ${oque}${detalhe ? `\n     ${detalhe}` : ""}`);
};

const ENV = { CREDITOS_CANAIS: "1", INGEST_SECRET: "segredo-de-teste" };
const fetchReal = globalThis.fetch;
const errReal = console.error;
console.error = () => {}; // emitFailure grita no console de propósito; aqui seria só ruído

// Espião de fetch: guarda cada chamada e responde o que o caso mandar para `consumir_creditos`.
// Todo o resto (feed de falha, trava do alarme) recebe um 200 inofensivo.
function espiao(respostaDoMedidor) {
  const chamadas = [];
  globalThis.fetch = async (url, init = {}) => {
    let corpo = null;
    try { corpo = JSON.parse(init.body || "null"); } catch { corpo = null; }
    const rpc = String(url).split("/rpc/")[1] || String(url);
    chamadas.push({ rpc, corpo });
    if (rpc === "consumir_creditos") return respostaDoMedidor(corpo);
    return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  return {
    chamadas,
    debitos: () => chamadas.filter((c) => c.rpc === "consumir_creditos"),
    falhas: () => chamadas.filter((c) => c.rpc === "ingest_client_event" && c.corpo && c.corpo.p_type === "failure"),
  };
}
const jsonResp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// ── CASO 1 — o preço vem da tabela do produto, não daqui ──────────────────────────────────────
{
  ok(custoDe("chat") === CREDIT_COST.chat, "1. chat tem que custar CREDIT_COST.chat");
  ok(custoDe("sms") === CREDIT_COST.sms, "1. sms tem que custar CREDIT_COST.sms");
  ok(custoDe("email") === CREDIT_COST.email, "1. email tem que custar CREDIT_COST.email");
  // WhatsApp/direct não têm linha própria: pegam a MENOR tarifa de mensagem, nunca um número novo.
  for (const canal of ["whatsapp", "instagram", "messenger"]) {
    ok(custoDe(canal) === (CREDIT_COST[canal] ?? CREDIT_COST.sms), `1. ${canal} tem que seguir a tabela (linha própria ou a tarifa de sms)`);
  }
  ok(custoDe("telepatia") === 0 && custoDe("") === 0 && custoDe("constructor") === 0,
    "1. canal sem preço custa 0 — preço nunca se inventa");

  const s = espiao(() => jsonResp({ ok: true, saldo: 498, cobrado: CREDIT_COST.chat, antes: 500, cruzou_zero: false }));
  const r = await debitar(ENV, { email: "Dona@Spa.com ", kind: "chat", ref: "chat:dona@spa.com:s1:2026-09-27" });
  const d = s.debitos();
  ok(d.length === 1, "1. um débito tem que virar UMA chamada ao medidor", `foram ${d.length}`);
  ok(d[0]?.corpo?.p_credits === CREDIT_COST.chat, "1. p_credits tem que ser o valor da tabela", JSON.stringify(d[0]?.corpo));
  ok(d[0]?.corpo?.p_email === "dona@spa.com", "1. o tenant vai normalizado (minúsculo, sem espaço)");
  ok(d[0]?.corpo?.p_kind === "chat" && d[0]?.corpo?.p_secret === ENV.INGEST_SECRET, "1. kind e segredo têm que ir na chamada");
  ok(r.ok === true && r.debitado === CREDIT_COST.chat && r.saldo === 498 && r.motivo === "debitado",
    "1. o recibo tem que dizer quanto saiu e quanto sobrou", JSON.stringify(r));
  ok(s.falhas().length === 0, "1. débito normal não é falha");
}

// ── CASO 2 — a referência é idempotente ───────────────────────────────────────────────────────
{
  const manha = new Date("2026-09-27T09:00:00Z");
  const noite = new Date("2026-09-27T23:59:00Z");
  const amanha = new Date("2026-09-28T00:01:00Z");
  ok(refChat("a@b.com", "sess1", manha) === "chat:a@b.com:sess1:2026-09-27", "2. formato da referência do chat", refChat("a@b.com", "sess1", manha));
  ok(refChat("a@b.com", "sess1", manha) === refChat("A@B.com", "sess1", noite), "2. mesma sessão no mesmo dia = MESMA referência (uma cobrança)");
  ok(refChat("a@b.com", "sess1", manha) !== refChat("a@b.com", "sess1", amanha), "2. no dia seguinte a sessão vira outra cobrança");
  ok(refChat("a@b.com", "sess1", manha) !== refChat("c@d.com", "sess1", manha), "2. a mesma sessão em OUTRO cliente não pode dividir a referência");
  ok(refChat("a@b.com", "", manha) === "" && refChat("", "sess1", manha) === "", "2. sem sessão ou sem tenant não existe referência");
  ok(refMensagem("sms", "SM123") === "sms:SM123", "2. SMS usa o MessageSid");
  ok(refMensagem("whatsapp", "wamid.HBg=") === "wa:wamid.HBg=", "2. WhatsApp usa o id da mensagem", refMensagem("whatsapp", "wamid.HBg="));
  ok(refMensagem("instagram", "m_1") === "ig:m_1" && refMensagem("messenger", "m_1") === "msgr:m_1", "2. direct usa o mid, com prefixo por rede");
  ok(refMensagem("whatsapp", "") === "" && refMensagem("fax", "1") === "", "2. sem id do provedor (ou canal desconhecido) não existe referência");

  // O banco reconhece a referência repetida → recibo de "já debitado", zero crédito, zero alarme.
  const s = espiao(() => jsonResp({ ok: true, repetido: true, saldo: 498, cobrado: 0 }));
  const r = await debitar(ENV, { email: "a@b.com", kind: "whatsapp", ref: "wa:wamid.X" });
  ok(r.ok === true && r.debitado === 0 && r.motivo === "ja_debitado" && r.saldo === 498, "2. repetição devolve recibo limpo", JSON.stringify(r));
  ok(s.falhas().length === 0, "2. 'já debitado' NÃO pode virar falha — é o sistema funcionando");

  // Sem referência não se cobra: cobrança que não dá para provar idempotente não sai.
  const s2 = espiao(() => jsonResp({ ok: true, saldo: 1, cobrado: 1 }));
  const r2 = await debitar(ENV, { email: "a@b.com", kind: "sms", ref: "" });
  ok(r2.debitado === 0 && r2.motivo === "sem_ref" && s2.debitos().length === 0, "2. sem referência o medidor nem é chamado", JSON.stringify(r2));
}

// ── CASO 3 — medidor quebrado nunca lança, e vira falha VISÍVEL ───────────────────────────────
{
  // (a) o banco responde 500
  let s = espiao(() => new Response("boom", { status: 500 }));
  let r = await debitar(ENV, { email: "a@b.com", kind: "sms", ref: "sms:SM1" }).catch((e) => ({ lancou: String(e) }));
  ok(!r.lancou && r.ok === false && r.debitado === 0 && r.motivo === "falha_rpc", "3a. HTTP 500 tem que virar recibo de falha, não exceção", JSON.stringify(r));
  ok(s.falhas().some((f) => f.corpo.p_payload?.failure_type === "credito_nao_medido"), "3a. falha real de medição tem que aparecer no feed");

  // (b) a rede cai (fetch lança)
  s = espiao(() => { throw new Error("rede fora"); });
  r = await debitar(ENV, { email: "a@b.com", kind: "sms", ref: "sms:SM2" }).catch((e) => ({ lancou: String(e) }));
  ok(!r.lancou && r.ok === false && r.debitado === 0, "3b. rede caída não pode lançar", JSON.stringify(r));

  // (c) até o alarme cai junto (tudo lança) — ainda assim, nada de exceção
  globalThis.fetch = async () => { throw new Error("tudo fora"); };
  r = await debitar(ENV, { email: "a@b.com", kind: "sms", ref: "sms:SM3" }).catch((e) => ({ lancou: String(e) }));
  ok(!r.lancou && r.ok === false, "3c. medidor E alarme fora do ar: mesmo assim não lança", JSON.stringify(r));

  // (d) o banco recusa com motivo (cliente sem linha de crédito)
  s = espiao(() => jsonResp({ ok: false, motivo: "cliente sem linha de credito" }));
  r = await debitar(ENV, { email: "novo@b.com", kind: "chat", ref: "chat:novo@b.com:s:2026-09-27" });
  ok(r.ok === false && r.motivo === "falha_rpc" && s.falhas().length === 1, "3d. recusa do banco é falha de medição declarada", JSON.stringify(r));

  // (e) argumentos ausentes / lixo
  r = await debitar(ENV).catch((e) => ({ lancou: String(e) }));
  ok(!r.lancou && r.debitado === 0, "3e. chamada sem argumentos não lança");
  r = await debitar(undefined, { email: "a@b.com", kind: "chat", ref: "x" }).catch((e) => ({ lancou: String(e) }));
  ok(!r.lancou && r.debitado === 0, "3e. env ausente não lança");

  // (f) debitarDepois entrega a promessa ao waitUntil e não segura a resposta
  s = espiao(() => jsonResp({ ok: true, saldo: 10, cobrado: 1, antes: 11, cruzou_zero: false }));
  const entregues = [];
  const volta = await debitarDepois({ waitUntil: (p) => entregues.push(p) }, ENV, { email: "a@b.com", kind: "sms", ref: "sms:SM4" });
  ok(volta === null && entregues.length === 1, "3f. com waitUntil a medição vai para o fundo");
  const rf = await entregues[0];
  ok(rf && rf.motivo === "debitado", "3f. e a promessa entregue é a do débito", JSON.stringify(rf));
}

// ── CASO 4 — a sonda do canário não paga ──────────────────────────────────────────────────────
{
  ok(ehSonda("canary-2026-09-27-1015") && ehSonda("CANARY-x"), "4. sessionId 'canary-…' é sonda");
  ok(!ehSonda("sess-canary-1") && !ehSonda("") && !ehSonda(null), "4. sessão de visitante não é sonda");
  const s = espiao(() => jsonResp({ ok: true, saldo: 1, cobrado: 2 }));
  const r = await debitar(ENV, { email: "a@b.com", kind: "chat", ref: refChat("a@b.com", "canary-2026-09-27-1015") });
  ok(r.debitado === 0 && r.motivo === "sonda" && r.ok === true, "4. a sonda devolve recibo de 'sonda', sem débito", JSON.stringify(r));
  ok(s.chamadas.length === 0, "4. para a sonda NENHUMA chamada sai — nem medidor, nem alarme", `saíram ${s.chamadas.length}`);
}

// ── CASO 5 — a política do zero: avisa UMA vez, e conta interna não consome ───────────────────
{
  let s = espiao(() => jsonResp({ ok: true, saldo: -1, cobrado: 2, antes: 1, cruzou_zero: true, negativo: true }));
  let r = await debitar(ENV, { email: "a@b.com", kind: "chat", ref: "chat:a@b.com:s9:2026-09-27" });
  ok(r.ok === true && r.debitado === 2 && r.saldo === -1 && r.motivo === "cruzou_zero", "5. cruzar o zero DEBITA (saldo negativo é permitido) e avisa", JSON.stringify(r));
  ok(s.falhas().some((f) => f.corpo.p_payload?.failure_type === "credito_zerado"), "5. o aviso de zero tem que sair");

  s = espiao(() => jsonResp({ ok: true, saldo: -3, cobrado: 2, antes: -1, cruzou_zero: false, negativo: true }));
  r = await debitar(ENV, { email: "a@b.com", kind: "chat", ref: "chat:a@b.com:s10:2026-09-27" });
  ok(r.motivo === "debitado" && s.falhas().length === 0, "5. já negativo: debita calado — o aviso é só na transição", JSON.stringify(r));

  s = espiao(() => jsonResp({ ok: true, interno: true, saldo: 900, cobrado: 0 }));
  r = await debitar(ENV, { email: "sim@guileoai.com", kind: "chat", ref: "chat:sim@guileoai.com:s:2026-09-27" });
  ok(r.ok === true && r.debitado === 0 && r.motivo === "conta_interna" && s.falhas().length === 0, "5. conta interna não consome e não alarma", JSON.stringify(r));
}

// ── CASO 6 — desligado é desligado; e a quantidade tem teto ───────────────────────────────────
{
  for (const env of [{ INGEST_SECRET: "x" }, { INGEST_SECRET: "x", CREDITOS_CANAIS: "0" }, { INGEST_SECRET: "x", CREDITOS_CANAIS: "" }]) {
    const s = espiao(() => jsonResp({ ok: true, saldo: 1, cobrado: 2 }));
    const r = await debitar(env, { email: "a@b.com", kind: "chat", ref: "chat:a@b.com:s:2026-09-27" });
    // (2026-09-27) a chave também mora no banco (platform_settings.creditos_canais): desligado pode
    // fazer UMA leitura de configuração, mas NUNCA um débito.
    ok(r.debitado === 0 && r.motivo === "medidor_desligado" && s.debitos().length === 0,
      `6. sem CREDITOS_CANAIS=1 nada sai (valor: ${JSON.stringify(env.CREDITOS_CANAIS)})`, JSON.stringify(r));
  }
  let s = espiao((c) => jsonResp({ ok: true, saldo: 0, cobrado: c.p_credits, antes: 100, cruzou_zero: false }));
  await debitar(ENV, { email: "a@b.com", kind: "sms", ref: "sms:SM9", qtd: 3 });
  ok(s.debitos()[0]?.corpo?.p_credits === 3 * CREDIT_COST.sms, "6. qtd multiplica o preço da tabela");
  s = espiao((c) => jsonResp({ ok: true, saldo: 0, cobrado: c.p_credits, antes: 100, cruzou_zero: false }));
  await debitar(ENV, { email: "a@b.com", kind: "sms", ref: "sms:SM10", qtd: 5000 });
  ok(s.debitos()[0]?.corpo?.p_credits === 20 * CREDIT_COST.sms, "6. qtd absurda bate no teto — um bug não zera a conta de ninguém", String(s.debitos()[0]?.corpo?.p_credits));
  s = espiao(() => jsonResp({ ok: true, saldo: 1, cobrado: 1 }));
  const r = await debitar(ENV, { email: "a@b.com", kind: "telepatia", ref: "x:1" });
  ok(r.motivo === "kind_sem_preco" && s.chamadas.length === 0, "6. canal sem preço não debita", JSON.stringify(r));
}

globalThis.fetch = fetchReal;
console.error = errReal;

if (falhas) {
  console.log(`\n${falhas} caso(s) errado(s). O que está em jogo:`);
  console.log("   cobrança em dobro ou por mensagem -> o cliente vê o saldo sumir e pede o dinheiro de volta;");
  console.log("   medidor que lança                  -> contabilidade derrubando o atendimento.");
  process.exit(1);
}
console.log("✅ creditos: preço da tabela, referência idempotente, medidor quebrado não lança, sonda não paga, desligado não cobra");
