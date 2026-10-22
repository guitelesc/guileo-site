// A rota do portal entrega as métricas do Guileo Direct — e NUNCA transforma falha em zero.
//   node functions/lib/metaComentariosMetricas.test.mjs
let falhas = 0;
const ok = (c, o) => { if (!c) { falhas++; console.log("  ✗ " + o); } else console.log("  ✓ " + o); };

let chaveBoa = true;
let metricasMock = { funil: { dm_enviado: 3, casou: 3 }, conversa: {}, por_campanha: [] };
let metricasStatus = 200;
const chamadas = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url); let body = {}; try { body = JSON.parse(init.body || "{}"); } catch {}
  chamadas.push({ url: u, body });
  if (u.includes("/rpc/get_client_data")) return new Response(JSON.stringify(chaveBoa ? { events: [] } : null), { status: 200 });
  if (u.includes("/rpc/meta_campanhas_listar")) return new Response(JSON.stringify([{ id: "c1", nome: "Preço" }]), { status: 200 });
  if (u.includes("/rpc/meta_comment_stats")) return new Response(JSON.stringify({ enviados: 3 }), { status: 200 });
  if (u.includes("/rpc/direct_metricas")) return new Response(JSON.stringify(metricasMock), { status: metricasStatus });
  return new Response("{}", { status: 200 });
};
const { onRequestPost } = await import("../api/meta-comentarios.js");
const chama = async (corpo) => {
  const r = await onRequestPost({ request: new Request("https://x/api/meta-comentarios", { method: "POST", body: JSON.stringify(corpo) }),
    env: { INGEST_SECRET: "glo_ing_c7f2a9e4b8d16350" } });
  return { status: r.status, d: await r.json() };
};

console.log("\n— a lista já vem com o funil —");
let r = await chama({ email: "c@x.com", token: "k" });
ok(r.d.ok && Array.isArray(r.d.campanhas) && r.d.metricas?.funil?.dm_enviado === 3, "lista + métricas na mesma chamada (a aba abre com o funil pronto)");
ok(r.d.stats?.enviados === 3, "os stats antigos continuam (quem ainda lê não quebra)");
const pedido = chamadas.find((c) => c.url.includes("/rpc/direct_metricas"))?.body;
ok(pedido?.p_email === "c@x.com" && pedido?.p_dias === 30, "pede as métricas DO tenant autenticado, 30 dias por padrão");

console.log("\n— trocar o período —");
r = await chama({ email: "c@x.com", token: "k", action: "metricas", dias: 7 });
ok(r.d.dias === 7 && r.d.metricas && !("campanhas" in r.d), "action metricas devolve só o funil, no período pedido");
r = await chama({ email: "c@x.com", token: "k", action: "metricas", dias: 9999 });
ok(r.d.dias === 30, "período fora da lista (7/30/90) cai em 30 — ninguém pede 9999 dias ao banco");

console.log("\n— ERRO NÃO VIRA ZERO —");
metricasMock = { erro: "relation does not exist" };
r = await chama({ email: "c@x.com", token: "k", action: "metricas" });
ok(r.d.metricas === null && /relation/.test(r.d.metricas_erro), "erro do banco volta como metricas:null + o motivo, nunca um funil de zeros");
metricasMock = null; metricasStatus = 500;
r = await chama({ email: "c@x.com", token: "k", action: "metricas" });
ok(r.d.metricas === null && r.d.metricas_erro, "HTTP 500 também — com o motivo");
metricasStatus = 200; metricasMock = { funil: {} };

console.log("\n— o portão —");
chaveBoa = false;
r = await chama({ email: "c@x.com", token: "chave-errada", action: "metricas" });
ok(r.status === 401 && !chamadas.slice(-1)[0].url.includes("direct_metricas"), "chave errada → 401 ANTES de tocar nas métricas");
r = await chama({ email: "c@x.com", action: "metricas" });
ok(r.status === 401, "sem chave → 401");

console.log(falhas ? `\n❌ ${falhas} falha(s)\n` : "\n✅ meta-comentarios: métricas entregues, erro nunca vira zero, portão antes de tudo\n");
process.exit(falhas ? 1 : 0);
