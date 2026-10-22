// node --test functions/lib/preferenciasApi.test.mjs — /api/preferencias com banco e e-mail SIMULADOS.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../api/preferencias.js";
import { preferenciasUrl, visitaToken } from "./visita.js";

const ENV = { INGEST_SECRET: "segredo-de-teste", SCHED_SECRET: "sched", SUPABASE_SERVICE_ROLE: "svc", RESEND_API_KEY: "re_x" };
const T = "natura@example.com", A = "11111111-1111-4111-8111-111111111111";
let chamadas = [], visita = {};
globalThis.fetch = async (url, init = {}) => {
  const u = String(url); let body = null; try { body = init.body ? JSON.parse(init.body) : null; } catch { body = init.body; }
  chamadas.push({ u, body });
  const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  if (u.endsWith("/rpc/biz_visit_prefs")) {
    if (body.p_prefs && visita.closed) return resp({ ok: false, reason: "closed" });
    return resp({ ok: true, first: !visita.prefs, saved: !!body.p_prefs, closed: !!visita.closed, name: "Maria", contact: "maria@example.com", ref: "GUI-AB12", service: visita.service || "Massage 60min · Astoria", location: "Astoria", tz: "America/New_York", start: "2026-10-10T18:00:00Z", prefs: body.p_prefs || visita.prefs || null });
  }
  if (u.startsWith("https://api.resend.com/")) return resp({ id: "re_1" });
  return resp({});
};
const req = (path, init) => new Request(`https://guileoai.com${path}`, init);
beforeEach(() => { chamadas = []; visita = {}; });

test("link assinado só abre com o token certo", async () => {
  const url = new URL(await preferenciasUrl(ENV, T, A));
  assert.equal((await onRequestGet({ env: ENV, request: req(url.pathname + url.search) })).status, 200);
  assert.equal((await onRequestGet({ env: ENV, request: req(`/api/preferencias?t=${T}&a=${A}&s=000000000000000000000000`) })).status, 404);
  // token de OUTRO propósito (feedback) não abre preferências
  const s = await visitaToken(ENV, T, A, "visita");
  assert.equal((await onRequestGet({ env: ENV, request: req(`/api/preferencias?t=${T}&a=${A}&s=${s}`) })).status, 404);
});

test("página: massagem mostra pressão e foco; facial não", async () => {
  const url = new URL(await preferenciasUrl(ENV, T, A));
  const m = await (await onRequestGet({ env: ENV, request: req(url.pathname + url.search) })).text();
  assert.match(m, /name="pressure"/); assert.match(m, /id="focus"/); assert.match(m, /noindex/);
  visita.service = "Facial · Astoria";
  const f = await (await onRequestGet({ env: ENV, request: req(url.pathname + url.search) })).text();
  assert.doesNotMatch(f, /name="pressure"/); assert.doesNotMatch(f, /id="focus"/);
  assert.equal(chamadas.filter((c) => c.u.startsWith("https://api.resend.com/")).length, 0, "abrir o link não avisa ninguém");
});

test("enviar: grava só o permitido, avisa o salão com a alergia e registra no painel", async () => {
  const url = new URL(await preferenciasUrl(ENV, T, A));
  const s = url.searchParams.get("s");
  const r = await onRequestPost({ env: ENV, request: req("/api/preferencias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: T, a: A, s, prefs: { conversation: "quiet", pressure: "firm", allergies: "Nuts", hack: "drop table" } }) }) });
  assert.equal((await r.json()).ok, true);
  const grav = chamadas.find((c) => c.u.endsWith("/rpc/biz_visit_prefs") && c.body.p_prefs).body.p_prefs;
  assert.deepEqual(grav, { conversation: "quiet", pressure: "firm", allergies: "Nuts" });
  const mail = chamadas.find((c) => c.u.startsWith("https://api.resend.com/")).body;
  assert.equal(mail.to, T); assert.equal(mail.reply_to, "maria@example.com");
  assert.match(mail.html, /Nuts/); assert.match(mail.html, /Quiet time, please/);
  assert.ok(chamadas.some((c) => c.u.endsWith("/rpc/ingest_client_event") && c.body.p_type === "booking"));
});

test("vazio, link errado e visita já passada são recusados", async () => {
  const s = (new URL(await preferenciasUrl(ENV, T, A))).searchParams.get("s");
  const post = (b) => onRequestPost({ env: ENV, request: req("/api/preferencias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }) });
  assert.equal((await post({ t: T, a: A, s, prefs: {} })).status, 400);
  assert.equal((await post({ t: T, a: A, s: "x".repeat(24), prefs: { scent: "none" } })).status, 404);
  visita.closed = true;
  assert.equal((await post({ t: T, a: A, s, prefs: { scent: "none" } })).status, 409);
  const g = await onRequestGet({ env: ENV, request: req(`/api/preferencias?t=${T}&a=${A}&s=${s}`) });
  assert.match(await g.text(), /already started or ended/);
});
