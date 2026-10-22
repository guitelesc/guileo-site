// Prova do avisarDono sem rede: `fetch` é substituído por um dublê que anota cada chamada.
//   node functions/lib/avisarDono.test.mjs
// O que precisa ser verdade para o helper servir de alarme:
//   1. `false` da trava CALA os três canais (anti-spam funciona);
//   2. trava ilegível NÃO cala (regra do "não sei");
//   3. Resend respondendo não-ok vira email.ok=false com o motivo — nunca "enviado";
//   4. sem telefone cadastrado, whatsapp.ok=false e o motivo diz como cadastrar;
//   5. o destinatário padrão é a caixa que o dono lê (luistelesc@gmail.com), OWNER_EMAIL vence.
import assert from "node:assert/strict";
import { avisarDono, donoEmail } from "./avisarDono.js";

const chamadas = [];
function dublê({ claim = true, resendOk = true, telefone = "" } = {}) {
  chamadas.length = 0;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    // a Twilio recebe form-urlencoded; só o resto é JSON
    let body = null;
    try { body = opts && opts.body ? (typeof opts.body === "string" ? JSON.parse(opts.body) : Object.fromEntries(opts.body)) : null; } catch { body = String(opts.body); }
    chamadas.push({ url: u, body });
    const resp = (status, body) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
    if (u.endsWith("/rpc/health_claim")) return resp(200, claim);
    if (u.endsWith("/rpc/ingest_client_event")) return resp(200, 42);
    if (u.endsWith("/rpc/client_notify_phone_lookup")) return resp(200, JSON.stringify(telefone));
    if (u.includes("api.resend.com")) return resendOk ? resp(200, { id: "re_123" }) : resp(422, { message: "invalid to" });
    if (u.includes("api.twilio.com")) return resp(201, { sid: "SM1" });
    return resp(404, { code: "PGRST202" });
  };
}
const env = { INGEST_SECRET: "x", RESEND_API_KEY: "k", TWILIO_ACCOUNT_SID: "AC", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+15550000000", TWILIO_WHATSAPP_FROM: "+15550000000" };

// 1) trava false → nada sai
dublê({ claim: false });
let r = await avisarDono(env, { kind: "teste", summary: "x" });
assert.ok(r.pulado, "trava false deve pular");
assert.equal(chamadas.filter((c) => c.url.includes("resend")).length, 0, "e-mail não pode sair com trava false");

// 2) trava ilegível (404) → sai mesmo assim
dublê({ claim: true });
globalThis.fetch = ((orig) => async (u, o) => (String(u).endsWith("/rpc/health_claim") ? new Response("{}", { status: 404 }) : orig(u, o)))(globalThis.fetch);
r = await avisarDono(env, { kind: "teste", summary: "x" });
assert.ok(!r.pulado && r.email && r.email.ok === true, "trava ilegível não pode calar o aviso");
assert.equal(r.email.id, "re_123", "o recibo carrega o id do Resend");

// 3) Resend não-ok → email.ok=false com motivo, feed continua ok
dublê({ resendOk: false });
r = await avisarDono(env, { kind: "teste", summary: "x" });
assert.equal(r.email.ok, false);
assert.match(r.email.motivo, /invalid to/);
assert.equal(r.feed.ok, true);

// 4) sem telefone → whatsapp honesto
dublê({ telefone: "" });
r = await avisarDono(env, { kind: "teste", summary: "x" });
assert.equal(r.whatsapp.ok, false);
assert.match(r.whatsapp.motivo, /notify-phone/);
// com telefone → tenta a Twilio de verdade (dublê 201) e confere o corpo
dublê({ telefone: "+15551234567" });
r = await avisarDono(env, { kind: "teste", summary: "caiu" });
assert.equal(r.whatsapp.ok, true);
const tw = chamadas.find((c) => c.url.includes("api.twilio.com"));
assert.ok(tw, "deve ter chamado a Twilio");

// 5) destinatário
assert.equal(donoEmail({}), "luistelesc@gmail.com");
assert.equal(donoEmail({ OWNER_EMAIL: "a@b.com, c@d.com" }), "a@b.com");
const re = chamadas.find((c) => c.url.includes("resend"));
assert.equal(re.body.to, "luistelesc@gmail.com");

console.log("✅ avisarDono: trava cala · trava ilegível não cala · .ok conferido · whatsapp honesto · destinatário certo");
