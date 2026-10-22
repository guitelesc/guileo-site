// ACESSO NOMINAL DE PARCEIRO (CR-03) — partes puras + o handler com Supabase/Resend de mentira.
//   node functions/lib/parceiroAcesso.test.mjs
import assert from "node:assert/strict";
import { OTP_OK, gerarOtp, hashOtp, senhaInicial } from "./parceiroAcesso.js";
import { partnerCodeEmail } from "./emailTemplates.js";
import { onRequestPost } from "../api/parceiro-acesso.js";

let falhas = 0;
const caso = async (nome, fn) => { try { await fn(); console.log("ok  ", nome); } catch (e) { falhas++; console.log("FAIL", nome, "\n    ", e.message); } };

await caso("otp tem 6 dígitos; 200 sorteios, todos válidos", () => { for (let i = 0; i < 200; i++) assert.match(gerarOtp(), OTP_OK); });
await caso("hash é determinístico e muda com o e-mail", async () => {
  assert.equal(await hashOtp("A@x.com", "123456"), await hashOtp("a@x.com ", "123456"));
  assert.notEqual(await hashOtp("a@x.com", "123456"), await hashOtp("b@x.com", "123456"));
});
await caso("senha inicial: 16 caracteres sem ambíguos", () => { const s = senhaInicial(); assert.equal(s.length, 16); assert.doesNotMatch(s, /[0OIl1]/); });
await caso("e-mail do código mostra o código e NUNCA uma chave", () => {
  const { subject, html: h } = partnerCodeEmail({ name: "Ana", code: "482913", tenantName: "Test account" });
  assert.match(subject, /482913/); assert.match(h, /482913/); assert.match(h, /Test account/); assert.doesNotMatch(h, /access_key|chave de conex/i);
});

// ── handler com rede de mentira ──
const KEY = "d4" + "0".repeat(30);
const rede = { enviados: [], rpc: [] };
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url); const body = opts.body ? JSON.parse(opts.body) : {};
  const ok = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json" } });
  if (u.endsWith("/auth/v1/user")) return (opts.headers?.Authorization || "").includes("tok-ana-0123456789abcdef") ? ok({ email: "ana@scalepods.com" }) : ok({ msg: "bad" }, 401);
  if (u.includes("/rpc/blitz_stats")) return body.p_token === "senha-certa" ? ok([]) : ok({ msg: "x" }, 401);
  if (u.includes("/rpc/parceiro_me_svc")) return ok({ ok: true, nome: "Ana", tenants: ["e2e-test@guileoai.com"] });
  if (u.includes("/rpc/parceiro_otp_emitir_svc")) { if (body.p_tenant !== "e2e-test@guileoai.com") return ok({ ok: false, erro: "tenant" }); rede.rpc.push(body); return ok({ ok: true, nome: "Ana" }); }
  if (u.includes("/rpc/parceiro_otp_conferir_svc")) { const certo = rede.rpc.length && body.p_hash === rede.rpc.at(-1).p_hash; return certo ? ok({ ok: true, tenant: "e2e-test@guileoai.com", nome: "Ana", empresa: "Scale Pods", key: KEY }) : ok({ ok: false, erro: "otp" }); }
  if (u.includes("api.resend.com")) { rede.enviados.push(body); return ok({ id: "re_123" }); }
  if (u.includes("/auth/v1/admin/users")) return ok({ id: "uid-ana" });
  if (u.includes("/rpc/parceiro_admin")) return ok({ ok: true, parceiro: { id: "p1", nome: body.p_dados?.nome, email: body.p_dados?.email, tenants: body.p_dados?.tenants } });
  throw new Error("fetch inesperado " + u);
};
const env = { RESEND_API_KEY: "re", SCHED_SECRET: "s", SUPABASE_SERVICE_ROLE: "svc" };
const post = (b) => onRequestPost({ request: new Request("https://x/api/parceiro-acesso", { method: "POST", body: JSON.stringify(b) }), env });

await caso("token inválido → 401, nada enviado", async () => {
  const r = await post({ action: "otp", access_token: "tok-errado-0123456789abcdef", tenant: "e2e-test@guileoai.com" });
  assert.equal(r.status, 401); assert.equal(rede.enviados.length, 0);
});
await caso("otp: manda o código ao e-mail do token, com comprovante; a resposta não contém o código", async () => {
  const r = await post({ action: "otp", access_token: "tok-ana-0123456789abcdef", tenant: "e2e-test@guileoai.com", tenant_nome: "Test account" });
  const d = await r.json();
  assert.equal(d.ok, true); assert.equal(d.email_id, "re_123"); assert.equal(rede.enviados[0].to, "ana@scalepods.com");
  const otp = rede.enviados[0].subject.match(/\d{6}/)[0];
  assert.ok(!JSON.stringify(d).includes(otp), "o código vazou na resposta");
  assert.equal(await hashOtp("ana@scalepods.com", otp), rede.rpc.at(-1).p_hash);
  globalThis.__otp = otp;
});
await caso("CONTROLE: tenant fora da lista → 403", async () => {
  const r = await post({ action: "otp", access_token: "tok-ana-0123456789abcdef", tenant: "naturaspaadm@gmail.com" });
  assert.equal(r.status, 403);
});
await caso("confirmar com código errado → 403, sem chave", async () => {
  const r = await post({ action: "confirmar", access_token: "tok-ana-0123456789abcdef", otp: "000000" });
  assert.equal(r.status, 403); assert.ok(!(await r.text()).includes(KEY));
});
await caso("confirmar com o código certo → chave do cliente, tenant e nome", async () => {
  const r = await post({ action: "confirmar", access_token: "tok-ana-0123456789abcdef", otp: globalThis.__otp });
  const d = await r.json();
  assert.equal(d.ok, true); assert.equal(d.key, KEY); assert.equal(d.tenant, "e2e-test@guileoai.com"); assert.equal(d.email_parceiro, "ana@scalepods.com");
});
await caso("admin: senha errada → 401; senha certa cria usuário + linha e devolve a senha inicial uma vez", async () => {
  assert.equal((await post({ action: "admin_criar", admin_token: "x", nome: "Ana", email: "ana@scalepods.com", tenants: ["e2e-test@guileoai.com"] })).status, 401);
  const d = await (await post({ action: "admin_criar", admin_token: "senha-certa", nome: "Ana", email: "ana@scalepods.com", tenants: ["e2e-test@guileoai.com"] })).json();
  assert.equal(d.ok, true); assert.equal(d.senha_inicial.length, 16); assert.deepEqual(d.parceiro.tenants, ["e2e-test@guileoai.com"]);
});
await caso("admin: sem SUPABASE_SERVICE_ROLE recusa criar (fail-closed)", async () => {
  const r = await onRequestPost({ request: new Request("https://x", { method: "POST", body: JSON.stringify({ action: "admin_criar", admin_token: "senha-certa", nome: "A", email: "a@b.c", tenants: [] }) }), env: { SCHED_SECRET: "s" } });
  assert.equal(r.status, 503);
});
console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo ok");
process.exit(falhas ? 1 : 0);
