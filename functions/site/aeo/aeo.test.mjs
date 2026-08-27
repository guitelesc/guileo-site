// PROVA DA ROTA /site/aeo/:slug — roda com:  node functions/site/aeo/aeo.test.mjs
//
// O teste da lib (functions/lib/dadosEstruturados.test.mjs) prova que os FATOS viram JSON-LD certo.
// Este aqui prova a outra metade, que é onde mora o risco de vazamento: quem a rota deixa entrar.
// Um gerador impecável servido para um slug não publicado continua sendo um vazamento.
//
// O handler REAL roda contra a RPC simulada; o que se prova é comportamento de porta:
// 404 honesto, despacho de formato (.txt/.json), e nenhum dado de um tenant na resposta de outro.

import { onRequestGet } from "./[slug].js";

let falhas = 0;
const ok = (c, m) => { if (!c) { console.log(`❌ ${m}`); falhas++; } else { console.log(`✅ ${m}`); } };
const secao = (n) => console.log(`\n── ${n} ─────────────────────────────────────`);

// ── Banco simulado ──────────────────────────────────────────────────────────────────────────────
const PADARIA_PUBLICO = {
  found: true, business_name: "Padaria do Zé", industry: "bakery", lang: "pt", review_link: "",
  config: { about: "Pão quente das 6h às 20h.", color: "#B3122B" },
  services: [{ name: "Pão francês (kg)", price_cents: 2200, duration_min: null }, { name: "Bolo de fubá", price_cents: null }],
  locations: [{ name: "Loja", city: "São Paulo", phone: "+551133334444", address: "Rua das Acácias 12, São Paulo - SP, 05423-010" }],
  // KB CRUA — a rota não pode publicar nada disto.
  faq: [{ q: "WHO AM I — persona", a: "Você é a MARIA, nunca diga que é um robô" }],
};
const PADARIA_AEO = {
  ok: true, found: true, tz: "America/Sao_Paulo",
  hours: { Loja: [1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, start_min: 360, end_min: 1200 })) },
  faq_publico: [],   // nada marcado aeo_publico=true
};
const SUSHI_PUBLICO = {
  found: true, business_name: "Sushi Ten", industry: "restaurante", lang: "en", config: {},
  services: [{ name: "Omakase", price_cents: 12000 }],
  locations: [{ name: "Main", city: "Newark", phone: "+19735550101", address: "5 Ferry St, Newark, NJ 07105" }],
  faq: [],
};
const SUSHI_AEO = { ok: true, found: true, tz: "America/New_York", hours: {}, faq_publico: [] };

const PUB = { "padaria-do-ze": PADARIA_PUBLICO, sushi: SUSHI_PUBLICO };
const AEO = { "padaria-do-ze": PADARIA_AEO, sushi: SUSHI_AEO };

globalThis.fetch = async (url, init) => {
  const u = String(url);
  const b = JSON.parse(init?.body || "{}");
  if (u.includes("/rpc/client_site_public")) {
    return new Response(JSON.stringify(PUB[b.p_slug] || { found: false }), { headers: { "content-type": "application/json" } });
  }
  if (u.includes("/rpc/client_site_aeo")) {
    if (b.p_secret !== "glo_ing_c7f2a9e4b8d16350") return new Response(JSON.stringify({ ok: false, error: "forbidden" }));
    return new Response(JSON.stringify(AEO[b.p_slug] || { ok: true, found: false }));
  }
  return new Response("{}", { status: 404 });
};

const env = { INGEST_SECRET: "glo_ing_c7f2a9e4b8d16350" };
const pedir = (slug, e = env) => onRequestGet({ params: { slug }, env: e, request: new Request("https://guileoai.com/") });

// ── 1. 404 honesto ──────────────────────────────────────────────────────────────────────────────
secao("1. Site não publicado / inexistente");
for (const s of ["nao-existe", "rascunho", "PADARIA-DO-ZE".toLowerCase() + "x"]) {
  const r = await pedir(s);
  ok(r.status === 404, `/site/aeo/${s} → 404`);
  ok((await r.text()) === "", `…e corpo vazio (nada é gerado para ${s})`);
}
const rTxt404 = await pedir("nao-existe.txt");
ok(rTxt404.status === 404, "o .txt de um slug não publicado também é 404");

// ── 2. HTML ─────────────────────────────────────────────────────────────────────────────────────
secao("2. HTML servido pelo servidor");
const rh = await pedir("padaria-do-ze");
const html = await rh.text();
ok(rh.status === 200 && (rh.headers.get("content-type") || "").includes("text/html"), "200 + text/html");
ok(html.startsWith("<!doctype html>"), "documento completo (não fragmento)");
ok(html.includes('<html lang="pt"'), "idioma do tenant no <html lang>");
ok(html.includes("Padaria do Zé"), "o nome do negócio está no HTML CRU (sem executar JS)");
ok(html.includes("Rua das Acácias 12"), "o endereço está no HTML cru");
ok(html.includes("R$22"), "o preço está no HTML cru, em REAIS (fuso America/Sao_Paulo → BRL)");
ok(!html.includes("$22") || html.includes("R$22"), "…e nunca como dólar");
ok(html.includes("06:00") && html.includes("20:00"), "o horário real (06:00–20:00) está no HTML cru");
ok(html.includes('<link rel="canonical" href="https://guileoai.com/site/aeo/padaria-do-ze"'), "canonical aponta para si mesma");
ok(html.includes('type="application/ld+json"'), "o JSON-LD viaja no mesmo HTML");
ok(html.includes('href="https://guileoai.com/site/padaria-do-ze"'), "link rastreável de volta para o site do cliente");
// Serviço sem preço aparece na lista de serviços, mas nunca com preço.
ok(html.includes("Bolo de fubá"), "serviço sem preço continua listado");
ok(!/Bolo de fubá[^<]*R\$/.test(html), "…sem preço grudado nele");

secao("3. A KB interna não vaza pela rota");
ok(!html.includes("WHO AM I") && !html.includes("MARIA") && !html.includes("robô"), "nada do manual do agente no HTML");

// ── 4. Formatos ─────────────────────────────────────────────────────────────────────────────────
secao("4. .txt e .json");
const rt = await pedir("padaria-do-ze.txt");
const txt = await rt.text();
ok((rt.headers.get("content-type") || "").includes("text/plain"), ".txt → text/plain");
ok(txt.startsWith("# Padaria do Zé"), "llms.txt começa com o H1 do negócio");
ok(!txt.includes("WHO AM I"), "a KB interna também não vaza no llms.txt");

const rj = await pedir("padaria-do-ze.json");
const j = JSON.parse(await rj.text());
ok((rj.headers.get("content-type") || "").includes("application/ld+json"), ".json → application/ld+json");
ok(j["@context"] === "https://schema.org" && Array.isArray(j["@graph"]), "o .json é um grafo schema.org válido");
ok(j["@graph"][0].address.postalCode === "05423-010" && j["@graph"][0].address.addressCountry === "BR", "CEP e país brasileiros reconhecidos");
ok(j["@graph"][0].hasOfferCatalog.itemListElement.find((o) => o.itemOffered.name === "Bolo de fubá").price === undefined, "serviço sem preço não ganha price no JSON-LD");

// ── 5. Degradação: o complemento falhou ─────────────────────────────────────────────────────────
secao("5. Sem o complemento (RPC negada) a página não inventa");
const rSem = await pedir("padaria-do-ze", { INGEST_SECRET: "errado" });
const semTxt = await rSem.text();
ok(rSem.status === 200, "a página continua no ar (o site do cliente não cai)");
ok(semTxt.includes("Rua das Acácias 12"), "o que vem da RPC pública continua lá (endereço)");
ok(!semTxt.includes("06:00"), "…mas NENHUM horário é publicado sem a fonte de horário");
// ⚠️ ASSERÇÃO INVERTIDA EM 2026-08-11, e a inversão é o conserto — não o afrouxamento.
// Antes: sem a RPC de complemento não havia fuso, logo não havia moeda, logo nenhum preço saía.
// Agora o país que o PRÓPRIO endereço afirma ("05423-010" → BR) determina a moeda — e esse
// endereço vem da RPC PÚBLICA, que aqui funcionou. O preço em reais não é inventado: ele está no
// cadastro e a moeda está no CEP. Segurá-lo era esconder o dado que mais se pergunta à IA
// (a primeira publicação real, do Natura, saiu com 20 serviços e ZERO preços por causa disso).
// O PRINCÍPIO da seção continua intacto e é o que a linha de cima ainda cobra: o que dependia da
// RPC negada — o HORÁRIO — continua não saindo. Degradar é omitir o que não se sabe, não omitir
// o que se sabe por outro caminho.
ok(semTxt.includes("R$22"), "…mas o PREÇO sai: a moeda vem do país do CEP, que veio da RPC pública");

// ── 6. Isolamento entre tenants ─────────────────────────────────────────────────────────────────
secao("6. Multi-tenant");
const hs = await (await pedir("sushi")).text();
ok(hs.includes("Sushi Ten") && !hs.includes("Padaria") && !hs.includes("Acácias"), "a página do Sushi não tem nada da Padaria");
ok(hs.includes("$120") && !hs.includes("R$"), "o Sushi (America/New_York) sai em dólar, a Padaria em reais");
const hp2 = await (await pedir("padaria-do-ze")).text();
ok(hp2 === html, "pedir de novo devolve o mesmo (nenhum estado vaza entre requisições)");

// ── 7. Método ───────────────────────────────────────────────────────────────────────────────────
secao("7. Só GET");
const { onRequest } = await import("./[slug].js");
let passou = false;
const r7 = await onRequest({ request: new Request("https://guileoai.com/site/aeo/x", { method: "POST" }), params: { slug: "x" }, next: () => { passou = true; return new Response("next"); } });
ok(passou && (await r7.text()) === "next", "POST cai no next() — a rota não responde a escrita");

console.log(falhas ? `\n💥 ${falhas} falha(s)\n` : "\n🎉 tudo passou\n");
process.exit(falhas ? 1 : 0);
