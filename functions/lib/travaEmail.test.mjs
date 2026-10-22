// A trava de e-mail tira o Gmail do Luis da saída — e SÓ ele. As duas falhas possíveis:
//   deixar passar → o dono pediu silêncio e continua recebendo;
//   barrar demais → cliente de verdade deixa de receber confirmação de agendamento.
import { filtrarEnvio, listaBloqueada, instalarTrava } from "./travaEmail.js";
let falhas = 0;
const ok = (c, m) => { if (!c) { falhas++; console.log("❌", m); } };
const B = listaBloqueada({});
ok(B.length === 1 && B[0] === "luistelesc@gmail.com", "padrão bloqueia o Gmail do Luis");
ok(listaBloqueada({ EMAILS_LUIS: "1" }).length === 0, "EMAILS_LUIS=1 desliga a trava");
let r = filtrarEnvio({ to: ["luistelesc@gmail.com"], subject: "x" }, B);
ok(r.vazio && r.removidos.length === 1, "só ele → não envia");
r = filtrarEnvio({ to: ["Luis <LuisTelesC@gmail.com>", "smart@guileoai.com"] }, B);
ok(!r.vazio && r.email.to.length === 1 && r.email.to[0] === "smart@guileoai.com", "ele + outro → envia só ao outro (nome e maiúscula)");
r = filtrarEnvio({ to: "cliente@spa.com", bcc: ["luistelesc@gmail.com"] }, B);
ok(!r.vazio && r.email.to === "cliente@spa.com" && !r.email.bcc, "cópia oculta pra ele sai, cliente recebe");
r = filtrarEnvio({ to: ["maria@cliente.com"] }, B);
ok(!r.vazio && r.removidos.length === 0, "cliente de verdade intocado");

// ponta a ponta com fetch falso
const chamadas = [];
globalThis.fetch = async (u, i) => { chamadas.push({ u, b: i && i.body }); return new Response(JSON.stringify({ id: "real" }), { status: 200 }); };
instalarTrava({});
let resp = await fetch("https://api.resend.com/emails", { method: "POST", body: JSON.stringify({ to: ["luistelesc@gmail.com"] }) });
let d = await resp.json();
ok(chamadas.length === 0 && d.bloqueado === true && d.id, "só ele: nada sai pra Resend, recibo com id");
resp = await fetch("https://api.resend.com/emails", { method: "POST", body: JSON.stringify({ to: ["luistelesc@gmail.com", "smart@guileoai.com"] }) });
ok(chamadas.length === 1 && JSON.parse(chamadas[0].b).to.join() === "smart@guileoai.com", "misto: sai só pro outro");
await fetch("https://api.stripe.com/v1/x", { method: "POST", body: "a=1" });
ok(chamadas.length === 2 && chamadas[1].b === "a=1", "outras APIs intocadas");
if (falhas) { console.log(`${falhas} erro(s)`); process.exit(1); }
console.log("✅ trava de e-mail: barra só o Gmail do Luis, cliente real recebe, outras APIs intocadas");
