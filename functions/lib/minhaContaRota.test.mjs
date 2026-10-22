// A ROTA /api/minha-conta com Supabase e Resend FALSOS (nada sai para a rede): resposta neutra, comprovante,
// freios, link assinado. node functions/lib/minhaContaRota.test.mjs
import { onRequestPost } from "../api/minha-conta.js";
import { contaToken, reservaUrl } from "./visita.js";

let falhas = 0, total = 0;
const confere = (n, c) => { total++; if (!c) { falhas++; console.log("❌", n); } };
const TEN = "spa@exemplo.com", CLI = "cliente@exemplo.com";
const chamadas = [];
let resendResp = { status: 200, body: { id: "re_123" } };
globalThis.fetch = async (url, init = {}) => {
  const u = String(url); const body = init.body ? JSON.parse(init.body) : {};
  chamadas.push({ u, body });
  if (u.includes("api.resend.com")) return new Response(JSON.stringify(resendResp.body), { status: resendResp.status });
  if (u.endsWith("/rpc/client_site_owner")) return new Response(JSON.stringify(body.p_slug === "spa-x" ? TEN : ""), { status: 200 });
  if (u.endsWith("/rpc/desk_conta_existe_svc")) return new Response(JSON.stringify(body.p_email === CLI && body.p_tenant === TEN ? { ok: true, existe: true, name: "Ana", business: "Spa X" } : { ok: true, existe: false }), { status: 200 });
  if (u.endsWith("/rpc/desk_conta_ver_svc")) return new Response(JSON.stringify(body.p_email === CLI && body.p_tenant === TEN ? { ok: true, name: "Ana",
      business: { name: "Spa X", slug: "spa-x", locations: [] },
      upcoming: [{ id: "48181fbf-1143-47ca-9cca-730fb84f2b57", service: "Massagem 60", start: "2026-11-17T15:00:00Z" }],
      past: [{ id: "11111111-2222-3333-4444-555555555555", service: "Facial", service_active: false }], packages: [], gift_cards: [] } : { ok: false, reason: "not_found" }), { status: 200 });
  if (u.endsWith("/rpc/ingest_client_event")) return new Response("null", { status: 200 });
  if (u.includes("/rpc/")) return new Response("{}", { status: 200 });
  return new Response("{}", { status: 404 });
};
const kv = new Map();
const env = { INGEST_SECRET: "seg", RESEND_API_KEY: "re_test", RATE_LIMIT: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } } };
let ip = 1;
const req = (body, { origin = "https://guileoai.com", novoIp = true } = {}) => new Request("https://guileoai.com/api/minha-conta", { method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin, "CF-Connecting-IP": `10.0.0.${novoIp ? ip++ : ip}` }, body: JSON.stringify(body) });
const chamar = async (body, opts) => { const jobs = []; const r = await onRequestPost({ request: req(body, opts), env, waitUntil: (p) => jobs.push(p) }); const j = await r.json(); const res = await Promise.all(jobs); return { http: r.status, j, jobs: res }; };

// pedir
const a = await chamar({ action: "pedir", t: "spa-x", email: "Cliente@Exemplo.com", lang: "pt" });
const b = await chamar({ action: "pedir", t: "spa-x", email: "ninguem@exemplo.com" });
const c = await chamar({ action: "pedir", t: "negocio-que-nao-existe", email: CLI });
confere("cliente, não-cliente e negócio desconhecido recebem a MESMA resposta", JSON.stringify(a.j) === JSON.stringify(b.j) && JSON.stringify(b.j) === JSON.stringify(c.j) && a.http === 200 && b.http === 200 && c.http === 200);
confere("cliente: e-mail saiu com id da Resend", a.jobs[0]?.enviado === true && a.jobs[0]?.id === "re_123");
const env1 = chamadas.find((x) => x.u.includes("resend"));
confere("e-mail foi para a cliente, com o nome do negócio no remetente e resposta no negócio", env1.body.to === CLI && env1.body.from.startsWith("Spa X <") && env1.body.reply_to === TEN);
confere("e-mail em pt com link /minha-conta?k=…&lang=pt", /minha-conta\?k=[^"&]+&amp;lang=pt|minha-conta\?k=[^"&]+&lang=pt/.test(env1.body.html) && /Abrir minha conta/.test(env1.body.html));
confere("não-cliente: nada enviado", b.jobs[0]?.enviado === false && b.jobs[0]?.motivo === "nao_cliente" && chamadas.filter((x) => x.u.includes("resend")).length === 1);
confere("negócio desconhecido: nem consulta o cliente", c.jobs.length === 0);
// Resend recusa → não conta como enviado e avisa o dono
resendResp = { status: 422, body: { message: "bad" } };
const d = await chamar({ action: "pedir", t: TEN, email: CLI });
confere("Resend recusou: resposta continua neutra, comprovante diz não enviado, dono avisado", JSON.stringify(d.j) === JSON.stringify(a.j) && d.jobs[0]?.enviado === false && chamadas.some((x) => x.u.endsWith("/rpc/ingest_client_event") && /NÃO saiu/.test(x.body.p_summary)));
resendResp = { status: 200, body: {} };
const d2 = await chamar({ action: "pedir", t: TEN, email: CLI });
confere("Resend 200 sem id NÃO é enviado", d2.jobs[0]?.enviado === false);
resendResp = { status: 200, body: { id: "re_456" } };
const e = await chamar({ action: "pedir", t: TEN, email: CLI });
confere("4º pedido na hora para o mesmo e-mail: freado (sem envio), resposta neutra", e.jobs.length === 0 && JSON.stringify(e.j) === JSON.stringify(a.j));
confere("e-mail inválido → 400 de formato", (await chamar({ action: "pedir", t: TEN, email: "x" })).http === 400);
confere("sem negócio → 400", (await chamar({ action: "pedir", email: CLI })).http === 400);
confere("outra origem → 403", (await chamar({ action: "pedir", t: TEN, email: CLI }, { origin: "https://evil.example" })).http === 403);
// freio por IP: 5 pedidos / 10 min
let ult; for (let i = 0; i < 6; i++) ult = await chamar({ action: "pedir", t: TEN, email: `p${i}@exemplo.com` }, { novoIp: false });
confere("6º pedido do mesmo IP → 429", ult.http === 429);

// ver
const k = await contaToken(env, TEN, CLI);
const v = await chamar({ action: "ver", k });
confere("ver com link certo → 200 e os dados", v.http === 200 && v.j.ok && v.j.name === "Ana" && v.j.email === CLI);
confere("próximo horário leva o link assinado de remarcar/cancelar", v.j.upcoming[0].manage_url === await reservaUrl(env, TEN, "48181fbf-1143-47ca-9cca-730fb84f2b57", "https://guileoai.com"));
confere("Marcar de novo → /agendar/<slug>?servico=", v.j.upcoming[0].rebook_url === "/agendar/spa-x?servico=Massagem%2060");
confere("serviço desativado não oferece Marcar de novo", v.j.past[0].rebook_url === "");
const adult = k.slice(0, -1) + (k.endsWith("0") ? "1" : "0");
confere("token adulterado → 401 invalid_link", (await chamar({ action: "ver", k: adult })).http === 401);
const vencido = await contaToken(env, TEN, CLI, { agora: Date.now() - 8 * 86400000 });

const vv = await chamar({ action: "ver", k: vencido });
confere("token vencido → 401 expired com o negócio", vv.http === 401 && vv.j.error === "expired" && vv.j.t === TEN);
const outro = await contaToken(env, TEN, "ninguem@exemplo.com");
confere("link de quem não é (mais) cliente → 404", (await chamar({ action: "ver", k: outro })).http === 404);
console.log(falhas ? `\n${falhas}/${total} errados` : `\n✅ ${total}/${total}`);
process.exit(falhas ? 1 : 0);
