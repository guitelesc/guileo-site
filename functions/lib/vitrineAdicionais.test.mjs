// ADICIONAIS NO /agendar (desk_v17) — o handler REAL de /api/vitrine-agenda com banco e motor simulados.
//   node --test functions/lib/vitrineAdicionais.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../api/vitrine-agenda.js";

const AROMA = "44444444-4444-4444-8444-000000000001", PEDRA = "44444444-4444-4444-8444-000000000002";
function cenario({ semLista = false } = {}) {
  const ch = { availability: [], book: [] };
  globalThis.fetch = async (url, op) => {
    const u = String(url); const body = op?.body ? JSON.parse(op.body) : {};
    const res = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
    if (u.includes("/rpc/client_site_owner")) return res("dona@exemplo.com");
    if (u.includes("/rpc/vitrine_addons")) return semLista ? res({}, 404) : res([{ id: AROMA, name: "Aromatherapy", duration_min: 10, price_cents: 2000 }, { id: PEDRA, name: "Hot stone", duration_min: 15, price_cents: 2500 }]);
    if (u.includes("/rpc/vitrine_pros")) return res([]);
    if (u.includes("/rpc/desk_can_book_online")) return res(true);
    if (u.includes("/rpc/")) return res({ ok: false });
    if (u.includes("/api/agent-schedule")) {
      if (body.op === "lookup") return res({ services: ["Deep Tissue"], priced: [{ name: "Deep Tissue", price_cents: 14000, duration_min: 60 }] });
      if (body.op === "availability") { ch.availability.push(body.extra_min ?? 0); return res({ slots: [{ start: "2026-10-23T14:00:00.000Z", pro: "Ana", location: "Astoria" }], tz: "America/New_York" }); }
      if (body.op === "book") { ch.book.push(body.attributes || null); return res({ ok: true, appointment_id: "appt-1", status: "booked" }); }
    }
    return res({}, 404);
  };
  return ch;
}
const env = { INGEST_SECRET: "i", AGENT_ACTION_SECRET: "a", SUPABASE_SERVICE_ROLE_KEY: "k", SINAL_TELA_MS: "5" };
const chamar = async (corpo) => {
  const req = new Request("https://guileoai.com/api/vitrine-agenda", { method: "POST", headers: { Origin: "https://guileoai.com", "Content-Type": "application/json" }, body: JSON.stringify({ slug: "spa-prova", ...corpo }) });
  const r = await onRequestPost({ request: req, env }); return { s: r.status, d: await r.json() };
};

test("menu lista os adicionais com tempo e preço", async () => {
  cenario();
  const { d } = await chamar({ op: "menu" });
  assert.deepEqual(d.adicionais.map((a) => [a.name, a.duration_min, a.price_cents]), [["Aromatherapy", 10, 2000], ["Hot stone", 15, 2500]]);
});
test("horários: o SERVIDOR soma os minutos dos adicionais válidos e ignora id inventado", async () => {
  const ch = cenario();
  await chamar({ op: "horarios", servico: "Deep Tissue", adicionais: [AROMA, PEDRA, "99999999-9999-4999-8999-999999999999"] });
  assert.deepEqual(ch.availability, [25]);
});
test("horários sem adicional: nada a mais (o motor nem recebe extra_min)", async () => {
  const ch = cenario();
  await chamar({ op: "horarios", servico: "Deep Tissue" });
  assert.deepEqual(ch.availability, [0]);
});
test("marcar leva os adicionais ao motor (attributes.addons)", async () => {
  const ch = cenario();
  const { d } = await chamar({ op: "marcar", servico: "Deep Tissue", quando: "2026-10-23T14:00:00.000Z", nome: "Maria", telefone: "+17185550142", adicionais: [AROMA] });
  assert.equal(d.ok, true); assert.deepEqual(ch.book, [{ addons: [AROMA] }]);
});
test("lista indisponível: nenhum adicional sai da página (marca só o serviço)", async () => {
  const ch = cenario({ semLista: true });
  const { d: m } = await chamar({ op: "menu" }); assert.equal(m.adicionais, undefined);
  await chamar({ op: "marcar", servico: "Deep Tissue", quando: "2026-10-23T14:00:00.000Z", nome: "Maria", telefone: "+17185550142", adicionais: [AROMA] });
  assert.deepEqual(ch.book, [null]);
});
