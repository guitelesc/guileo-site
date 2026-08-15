// PROVA DO APP DO CLIENTE (PWA por tenant) — roda com:  node functions/site/pwa.test.mjs
//
// POR QUE EXISTE: o "app" que a Guileo vende é o site do cliente instalável na marca DELE. Três
// arquivos gerados por tenant sustentam isso (manifest, service worker, ícone) mais a reescrita do
// <head>. Nenhum deles quebra de um jeito barulhento: se o manifest sair com o escopo errado, o
// Android simplesmente não oferece instalar; se o <head> não for reescrito, o iPhone instala o app
// do restaurante COM A LOGO DA GUILEO. Ninguém percebe até um cliente final reclamar.
//
// Então aqui as funções REAIS rodam contra uma resposta de banco simulada, e o <head> reescrito é
// o do index.html REAL que acabou de ser buildado (dist/index.html, com fallback pro index.html da
// raiz). O que se prova: identidade do negócio, isolamento entre tenants, e o 404 honesto.

import { readFileSync, existsSync } from "node:fs";

const onda = (nome) => `\n  ${nome}`;
let falhas = 0;
const ok = (cond, msg) => { if (!cond) { console.log(`❌ ${msg}`); falhas++; } };

// ── Banco de mentira ────────────────────────────────────────────────────────────────────────────
const PADARIA = {
  found: true, business_name: "Padaria do Zé", lang: "pt",
  config: { color: "#B3122B", about: "Pão quente das 6h às 20h.", headline: "Pão quente todo dia" },
  services: [{ name: "Pão francês", price_cents: 150 }],
  locations: [{ name: "Loja", city: "Newark", phone: "+19735550101" }],
  faq: [],
};
const SUSHI = { found: true, business_name: "Sushi Ten", lang: "en", config: { color: "#1B3A5C" }, services: [], locations: [], faq: [] };
const PUBLICADOS = { "padaria-do-ze": PADARIA, "sushi": SUSHI };

const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes("/rpc/client_site_public")) {
    const slug = JSON.parse(init.body).p_slug;
    return new Response(JSON.stringify(PUBLICADOS[slug] || { found: false }), { headers: { "content-type": "application/json" } });
  }
  return fetchOriginal(url, init);
};

const { onRequestGet: manifestGet } = await import("./manifest/[slug].js");
const { onRequestGet: swGet } = await import("./sw/[slug].js");
const { onRequestGet: iconGet } = await import("./icon/[slug].js");
const { onRequestGet: htmlGet } = await import("./[slug].js");

const ctx = (slug, next) => ({ params: { slug }, request: new Request("https://guileoai.com/x"), next });

// ── 1. MANIFEST ─────────────────────────────────────────────────────────────────────────────────
console.log(onda("manifest por tenant"));
{
  const r = await manifestGet(ctx("padaria-do-ze.webmanifest"));
  ok(r.status === 200, `manifest não veio 200 (${r.status})`);
  ok((r.headers.get("content-type") || "").startsWith("application/manifest+json"), "content-type do manifest errado");
  const m = await r.json();
  ok(m.name === "Padaria do Zé", `name = ${m.name}`);
  ok(m.short_name === "Padaria do" && m.short_name.length <= 12, `short_name = "${m.short_name}"`);
  ok(m.theme_color === "#B3122B", `theme_color = ${m.theme_color} (tinha que ser a cor do negócio)`);
  ok(m.description === "Pão quente das 6h às 20h.", "descrição não é a do próprio dono");
  ok(m.lang === "pt", `lang = ${m.lang}`);
  ok(m.display === "standalone", "display precisa ser standalone (tela cheia, cara de app)");
  // ISOLAMENTO: escopo e start_url presos ao slug. Um app que abrisse "/" seria o site da Guileo.
  ok(m.scope === "/site/padaria-do-ze", `scope vazando: ${m.scope}`);
  ok(m.start_url.startsWith("/site/padaria-do-ze"), `start_url vazando: ${m.start_url}`);
  ok(m.id === "/site/padaria-do-ze", `id vazando: ${m.id}`);
  ok(m.icons.length === 2 && m.icons.every((i) => i.src.includes("padaria-do-ze") && i.type === "image/png"),
    "ícones não são os deste tenant / não são PNG");
  ok(m.icons.some((i) => i.sizes === "192x192") && m.icons.some((i) => i.sizes === "512x512"), "faltou 192 e/ou 512");
  ok(m.icons.every((i) => i.purpose === "any maskable"), "ícone sem purpose maskable");
  // NADA DA GUILEO dentro do app de outro negócio.
  ok(!JSON.stringify(m).toLowerCase().includes("guileo"), "o manifest do cliente menciona a Guileo");
  ok(m.shortcuts?.[0]?.url === "/site/padaria-do-ze?acao=ligar", "atalho de ligar ausente/errado com telefone cadastrado");

  // Sem telefone → SEM atalho "Ligar". Botão que não liga não se publica.
  const semTel = await (await manifestGet(ctx("sushi.webmanifest"))).json();
  ok(!semTel.shortcuts, "criou atalho de ligar para um negócio sem telefone cadastrado");
  ok(semTel.theme_color === "#1B3A5C" && semTel.scope === "/site/sushi", "segundo tenant saiu com dado do primeiro");

  // HONESTIDADE DE ESTADO: não publicado → 404, nunca casca vazia com a marca de alguém.
  const nao = await manifestGet(ctx("fantasma.webmanifest"));
  ok(nao.status === 404, `slug não publicado devolveu ${nao.status} no manifest`);
  ok((await manifestGet(ctx("padaria-do-ze"))).status === 404, "manifest sem extensão devia ser 404");
}

// ── 2. SERVICE WORKER ───────────────────────────────────────────────────────────────────────────
console.log(onda("service worker escopado"));
{
  const r = await swGet(ctx("padaria-do-ze.js"));
  ok(r.status === 200, `sw não veio 200 (${r.status})`);
  ok((r.headers.get("content-type") || "").includes("javascript"), "content-type do sw errado");
  ok(r.headers.get("service-worker-allowed") === "/site/", "sem Service-Worker-Allowed o escopo por slug nem registra");
  ok((r.headers.get("cache-control") || "").includes("no-cache"), "sw servido de cache é um sw velho mandando no app inteiro");
  const js = await r.text();
  ok(js.includes('const SLUG = "padaria-do-ze"'), "sw sem o slug cravado");
  ok(!js.includes("sushi"), "sw de um tenant citando outro");
  // A trava que importa: /api/* nunca vai pro cache (preço/horário/agenda são dado VIVO).
  ok(/pathname\.startsWith\("\/api\/"\)\s*\)\s*return/.test(js), "sw não tem a trava de nunca cachear /api/");
  // E qualquer outro caminho sob /site/ passa direto — escopo de SW casa por prefixo de texto.
  ok(js.includes('if (pathname.startsWith("/site/")) return false'), "sw sem a guarda de outro slug");
  ok(js.includes('ks.filter((k) => k.startsWith(PREFIXO)'), "activate apagaria cache de outro tenant");
  ok(js.includes("Padaria do Zé"), "página offline sem o nome do negócio");
  ok(js.includes("tel:+19735550101"), "página offline sem o telefone (é o que funciona sem internet)");
  ok(js.includes("#B3122B"), "página offline fora da cor da marca");
  ok(!/guileo/i.test(js.replace(/guileo-site-/g, "").replace(/\/site\/sw\//g, "")), "sw do cliente exibindo a marca Guileo");
  ok((await swGet(ctx("fantasma.js"))).status === 404, "sw de site não publicado devia ser 404");
}

// ── 3. ÍCONE ────────────────────────────────────────────────────────────────────────────────────
console.log(onda("ícone na marca do negócio"));
{
  const r = await iconGet(ctx("padaria-do-ze-192.png"));
  ok(r.status === 200, `ícone não veio 200 (${r.status})`);
  ok(r.headers.get("content-type") === "image/png", "content-type do ícone errado");
  const b = new Uint8Array(await r.arrayBuffer());
  ok(b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47, "não é um PNG de verdade");
  // A cor da marca é a entrada 0 da paleta (ver appIcon.test.mjs) — aqui só confirmamos que ela
  // atravessou o endpoint sem ser trocada pela cor da casa.
  const plte = b.indexOf(0x50) && (() => { for (let i = 8; i < b.length - 8; i++) if (b[i] === 0x50 && b[i + 1] === 0x4c && b[i + 2] === 0x54 && b[i + 3] === 0x45) return i + 4; return -1; })();
  ok(plte > 0 && b[plte] === 0xb3 && b[plte + 1] === 0x12 && b[plte + 2] === 0x2b, "ícone saiu fora da cor do negócio");
  ok((await iconGet(ctx("padaria-do-ze-777.png"))).status === 404, "tamanho não gerado devia ser 404");
  ok((await iconGet(ctx("fantasma-192.png"))).status === 404, "ícone de site não publicado devia ser 404");
}

// ── 4. O <HEAD> DO HTML REAL ────────────────────────────────────────────────────────────────────
// A prova mais importante: a casca do SPA carrega o apple-touch-icon e o theme-color DA GUILEO.
// Sem esta reescrita, um cliente do restaurante instala o site e a logo da Guileo vai pra tela
// inicial do celular dele.
console.log(onda("<head> do site do cliente (index.html real)"));
{
  const arq = existsSync("dist/index.html") ? "dist/index.html" : "index.html";
  const casca = readFileSync(arq, "utf8");
  ok(/apple-touch-icon/.test(casca), `${arq} não tem apple-touch-icon — este teste ficou cego, revise-o`);

  const next = async () => new Response(casca, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  const r = await htmlGet(ctx("padaria-do-ze", next));
  const html = await r.text();

  ok(html.includes('<link rel="manifest" href="/site/manifest/padaria-do-ze.webmanifest" />'), "faltou o link do manifest no <head>");
  ok(html.includes('<link rel="apple-touch-icon" href="/site/icon/padaria-do-ze-192.png" />'), "apple-touch-icon não aponta pro ícone do negócio");
  ok(!html.includes('href="/apple-touch-icon.png"'), "A LOGO DA GUILEO continua como ícone de tela inicial do app do cliente");
  ok(!html.includes('href="/favicon.png"') && !html.includes('href="/favicon.svg"'), "favicon da Guileo sobrou no site do cliente");
  ok(html.includes('<meta name="theme-color" content="#B3122B" />'), "theme-color não é a cor do negócio");
  ok(!html.includes('content="#161512"'), "cimento do cockpit vazou pro app do cliente");
  ok(html.includes('name="apple-mobile-web-app-title" content="Padaria do"'), "iOS instalaria o app com o nome errado");
  ok(html.includes('name="apple-mobile-web-app-capable" content="yes"'), "sem apple-mobile-web-app-capable o iOS abre em aba, não em tela cheia");
  ok(html.includes("<title>Padaria do Zé · Newark</title>"), "o SEO da rota parou de funcionar depois da mudança");
  ok((html.match(/<link rel="manifest"/g) || []).length === 1, "manifest duplicado no <head>");

  // Não publicado → context.next() puro: nenhum manifesto, nenhum app, nada da marca de ninguém.
  let chamouNext = false;
  const r2 = await htmlGet(ctx("fantasma", async () => { chamouNext = true; return new Response(casca, { status: 200, headers: { "content-type": "text/html" } }); }));
  ok(chamouNext, "slug não publicado nem chegou no next()");
  ok(!(await r2.text()).includes("/site/manifest/"), "site não publicado ganhou manifesto de app");
}

console.log(falhas === 0
  ? "\n✅ PWA por tenant: manifest, service worker, ícone e <head> — identidade do negócio, isolamento entre slugs e 404 honesto"
  : `\n❌ ${falhas} falha(s) no PWA do cliente`);
process.exit(falhas ? 1 : 0);
