// node --test functions/lib/filaDeEspera.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { oferecerVaga } from "./filaDeEspera.js";

const feed = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes("ingest_client_event")) { feed.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); }
  return new Response("{}", { status: 200 });
};
const env = { RESEND_API_KEY: "x", INGEST_SECRET: "s", SUPABASE_SERVICE_ROLE_KEY: "k" };
const marca = async () => ({ name: "Natura Spa" });
const fila = (w) => ({ motor: async () => w, brandFor: marca });

test("ninguém na fila: não envia nada", async () => {
  const r = await oferecerVaga(env, { tenant: "a@b.com", appointmentId: "x" }, fila({ ok: true, filled: false }));
  assert.deepEqual(r, { offered: false, reason: "nobody_waiting" });
});

test("e-mail só conta como oferecido com id da Resend", async () => {
  feed.length = 0;
  const ok = await oferecerVaga(env, { tenant: "a@b.com", appointmentId: "x" }, { ...fila({ ok: true, filled: true, contact: "c@d.com", name: "Ana", service: "Facial" }), fetch: async () => new Response(JSON.stringify({ id: "re_1" }), { status: 200 }) });
  assert.equal(ok.offered, true); assert.equal(ok.receipt, "re_1");
  const sem = await oferecerVaga(env, { tenant: "a@b.com", appointmentId: "x" }, { ...fila({ ok: true, filled: true, contact: "c@d.com" }), fetch: async () => new Response("{}", { status: 200 }) });
  assert.equal(sem.offered, false);
  assert.ok(feed.some((f) => /NÃO chegou/.test(f.p_summary)), "dono avisado quando não chega");
});

test("texto recusado vira 'ligue pra oferecer' no feed", async () => {
  feed.length = 0;
  const r = await oferecerVaga(env, { tenant: "a@b.com", appointmentId: "x", lang: "pt" }, { ...fila({ ok: true, filled: true, contact: "+1 (718) 555-0100" }), sendText: async () => ({ sent: false, reason: "not configured" }) });
  assert.equal(r.offered, false);
  assert.match(feed[0].p_summary, /ligue pra oferecer/);
});

test("mensagem leva o nome do negócio, não 'Guileo'", async () => {
  let corpo = "";
  await oferecerVaga(env, { tenant: "a@b.com", appointmentId: "x", lang: "en" }, { ...fila({ ok: true, filled: true, contact: "+17185550100", service: "Massage" }), sendText: async (_e, _p, m) => { corpo = m; return { sent: true, sid: "SM1" }; } });
  assert.match(corpo, /Natura Spa/); assert.doesNotMatch(corpo, /Guileo/);
});

test("motor falhou: não lança", async () => {
  const r = await oferecerVaga(env, { tenant: "a@b.com", appointmentId: "x" }, { motor: async () => { throw new Error("boom"); } });
  assert.equal(r.offered, false);
});
