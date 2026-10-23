// ESCOLHER A PROFISSIONAL NO /agendar (desk_v16) — o handler REAL de /api/vitrine-agenda, com o banco e o motor
// simulados por fetch. Mora em functions/lib/ (não em functions/api/, que vira rota — ver vitrineAgenda.test.mjs).
// A conta e2e não tem site público (slug), então o caminho da vitrine é provado aqui; o motor (biz_availability /
// biz_book com p_pro_id) já é provado ao vivo pelo smoke do Desk.
//   node --test functions/lib/vitrineEscolha.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../api/vitrine-agenda.js";

const ANA = "11111111-1111-4111-8111-00000000000a", BIA = "11111111-1111-4111-8111-00000000000b", CARLA = "11111111-1111-4111-8111-00000000000c";
const T1 = "2026-10-23T14:00:00.000Z", T2 = "2026-10-23T15:00:00.000Z";
const nomeDe = { [ANA]: "Ana", [BIA]: "Bia", [CARLA]: "Carla" };

// cenário: Bia está "não marca pelo site"; a Ana já foi pega às T1 (o book dela recusa); Carla livre.
function cenario({ equipeFalha = false } = {}) {
  const chamadas = { book: [], availability: [] };
  globalThis.fetch = async (url, op) => {
    const u = String(url); const body = op?.body ? JSON.parse(op.body) : {};
    const res = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
    if (u.includes("/rpc/client_site_owner")) return res("dona@exemplo.com");
    if (u.includes("/rpc/vitrine_pros")) return equipeFalha ? res({ message: "function not found" }, 404) : res([
      { id: ANA, name: "Ana", title: "Massage", color: "#7FB7A0", locations: [], services: [{ service_id: "s1", name: "Deep Tissue", duration_min: 60, service_duration_min: 60 }] },
      { id: CARLA, name: "Carla", title: "Massage", color: "#9C8BD6", locations: [], services: [{ service_id: "s1", name: "Deep Tissue", duration_min: 75, service_duration_min: 60 }] }]);
    if (u.includes("/rpc/desk_can_book_online")) return res(true);
    if (u.includes("/rpc/")) return res({ ok: false });            // sinal etc.: sem Stripe → sem etapa de sinal
    if (u.includes("/api/agent-schedule")) {
      if (body.op === "lookup") return res({ services: ["Deep Tissue"], priced: [{ name: "Deep Tissue", price_cents: 14000 }], professionals: ["Ana", "Bia", "Carla"] });
      if (body.op === "availability") {
        chamadas.availability.push(body.pro_id || null);
        if (body.pro_id && !nomeDe[body.pro_id]) return res({ ok: false, reason: "pro_not_found", slots: [] });
        const todas = [ANA, BIA, CARLA].flatMap((p) => [T1, T2].map((start) => ({ start, pro: nomeDe[p], pro_id: p, location: "Astoria", duration_min: 60 })));
        return res({ slots: body.pro_id ? todas.filter((x) => x.pro_id === body.pro_id) : todas, tz: "America/New_York" });
      }
      if (body.op === "book") {
        chamadas.book.push(body.pro_id || null);
        if (body.pro_id === ANA && body.when === T1) return res({ ok: false, message: "acabou de sair" });
        return res({ ok: true, appointment_id: `appt-${body.pro_id || "motor"}`, status: "booked" });
      }
    }
    return res({}, 404);
  };
  return chamadas;
}
const env = { INGEST_SECRET: "i", AGENT_ACTION_SECRET: "a", SUPABASE_SERVICE_ROLE_KEY: "k", SINAL_TELA_MS: "5" };
const chamar = async (corpo) => {
  const req = new Request("https://guileoai.com/api/vitrine-agenda", { method: "POST", headers: { Origin: "https://guileoai.com", "Content-Type": "application/json" }, body: JSON.stringify({ slug: "spa-prova", ...corpo }) });
  const r = await onRequestPost({ request: req, env });
  return { s: r.status, d: await r.json() };
};

test("menu traz a equipe do site, sem quem está fora e sem contato", async () => {
  cenario();
  const { d } = await chamar({ op: "menu" });
  assert.deepEqual(d.equipe.map((p) => p.id), [ANA, CARLA]);
  for (const p of d.equipe) assert.deepEqual(Object.keys(p).sort(), ["color", "id", "name", "services", "title"]);
  assert.equal(d.equipe[1].services[0].duration_min, 75, "a duração DELA vai para a página");
});

test("sem preferência: horários com escolha e sem a Bia", async () => {
  cenario();
  const { d } = await chamar({ op: "horarios", servico: "Deep Tissue" });
  assert.equal(d.escolha, true);
  assert.ok(d.slots.length > 0 && d.slots.every((x) => x.pro_id !== BIA));
});

test("escolher a Ana: o motor recebe o id e só vêm os horários dela", async () => {
  const ch = cenario();
  const { d } = await chamar({ op: "horarios", servico: "Deep Tissue", pro_id: ANA });
  assert.deepEqual(ch.availability, [ANA]);
  assert.ok(d.slots.length && d.slots.every((x) => x.pro_id === ANA));
});

test("escolher quem está fora do site (Bia) é recusado, nos horários e na marcação", async () => {
  const ch = cenario();
  assert.equal((await chamar({ op: "horarios", servico: "Deep Tissue", pro_id: BIA })).s, 404);
  const m = await chamar({ op: "marcar", servico: "Deep Tissue", quando: T2, pro_id: BIA, nome: "X", telefone: "+17185550000" });
  assert.equal(m.s, 404); assert.equal(m.d.error, "pro_not_found");
  assert.deepEqual(ch.book, [], "nenhuma marcação tentada");
});

test("sem preferência na marcação: tenta as visíveis livres (Ana pega → Carla), nunca a Bia", async () => {
  const ch = cenario();
  const { d } = await chamar({ op: "marcar", servico: "Deep Tissue", quando: T1, nome: "Maria", telefone: "+17185550142" });
  assert.equal(d.ok, true); assert.equal(d.profissional, "Carla");
  assert.deepEqual(ch.book, [ANA, CARLA]);
});

test("escolhida na marcação: uma tentativa só, com ela", async () => {
  const ch = cenario();
  const { d } = await chamar({ op: "marcar", servico: "Deep Tissue", quando: T2, pro_id: ANA, nome: "Maria", telefone: "+17185550142" });
  assert.equal(d.ok, true); assert.equal(d.profissional, "Ana"); assert.deepEqual(ch.book, [ANA]);
});

test("escolhida e já pega: recusa honesta, sem cair noutra pessoa", async () => {
  const ch = cenario();
  const { s, d } = await chamar({ op: "marcar", servico: "Deep Tissue", quando: T1, pro_id: ANA, nome: "Maria", telefone: "+17185550142" });
  assert.equal(s, 409); assert.notEqual(d.ok, true); assert.deepEqual(ch.book, [ANA]);
});

test("lista do site fora do ar: a página volta a ser como antes (sem escolha, o motor decide)", async () => {
  const ch = cenario({ equipeFalha: true });
  const { d: m } = await chamar({ op: "menu" });
  assert.equal(m.equipe, undefined);
  const { d: h } = await chamar({ op: "horarios", servico: "Deep Tissue" });
  assert.equal(h.escolha, false);
  const { d: b } = await chamar({ op: "marcar", servico: "Deep Tissue", quando: T2, nome: "Maria", telefone: "+17185550142" });
  assert.equal(b.ok, true); assert.deepEqual(ch.book, [null]);
});
