// PROVA DO DOMÍNIO PRÓPRIO DO CLIENTE — roda com:  node functions/lib/dominio.test.mjs
//
// POR QUE EXISTE: roteamento por host erra CALADO e erra caro. Os dois erros possíveis:
//   (a) tratar guileoai.com como domínio de cliente → o site da Guileo sai do ar;
//   (b) servir a casa da Guileo (ou de OUTRO cliente) dentro do domínio de um cliente.
// Nenhum dos dois dá tela vermelha: a página abre, bonita, no endereço errado.
//
// Cada seção tem CASO PLANTADO — uma entrada que a regra TEM que recusar. Varredura sem controle
// negativo passa verde mesmo quebrada.
//
// Nada aqui toca rede nem banco: o `fetch` é trocado por um dublê e a casca é o index.html de
// verdade (dist/index.html quando existe; senão o index.html da raiz).
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  normalizarHost, ehNosso, hostDeCliente, semWww, caminhoDe, unidadeDoCaminho, ehEstatico,
  rotaDoCliente, cabecaDoCliente, ldVitrine, reescreverCabeca, robotsTxtDoCliente,
  sitemapDoCliente, bootDoCliente, robotsDe, jsonSeguro, VITRINES,
} from "./dominio.js";
import { onRequest, legado } from "../_middleware.js";

let falhas = 0;
let total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log(`❌ ${msg}`); falhas++; } };
const igual = (a, b, msg) => ok(a === b, `${msg} — veio ${JSON.stringify(a)}, esperado ${JSON.stringify(b)}`);
const secao = (n) => console.log(`── ${n}`);
const raiz = (p) => new URL(`../../${p}`, import.meta.url);

// ── 1. HOSTS ─────────────────────────────────────────────────────────────────────────────────
secao("hosts");
igual(normalizarHost("WWW.Example.COM."), "www.example.com", "WWW.Example.COM. normaliza");
igual(semWww(normalizarHost("WWW.Example.COM.")), "example.com", "chave de busca sem www");
igual(normalizarHost("  naturaspanyc.com "), "naturaspanyc.com", "espaço em volta sai");
for (const ruim of ["example.com:8080", "example.com/pagina", "https://example.com", "http://example.com/",
  "example.com?x=1", "exa mple.com", "localhost", "127.0.0.1", "1.2.3.4", "-a.com", "a-.com", "a..com",
  ".com", "com", "", null, undefined, "a.com/../b", "a.c", "exämple.com", "a.com..", "user@a.com", "[::1]"]) {
  igual(normalizarHost(ruim), null, `PLANTADO host inválido recusado: ${JSON.stringify(ruim)}`);
}
igual(normalizarHost("a".repeat(64) + ".com"), null, "PLANTADO rótulo de 64 letras recusado");
igual(normalizarHost("a.com."), "a.com", "um ponto final é tolerado");

for (const nosso of ["guileoai.com", "www.guileoai.com", "GUILEOAI.COM", "guileoai.com.", "guileoai.com:443",
  "abc123.guileoai.pages.dev", "guileoai.pages.dev", "qualquer.pages.dev", "localhost", "localhost:8788",
  "127.0.0.1", "127.0.0.1:8788", "app.localhost", "staging.guileoai.com"]) {
  ok(ehNosso(nosso) === true, `host NOSSO reconhecido: ${nosso}`);
  igual(hostDeCliente(nosso), null, `PLANTADO ${nosso} nunca é host de cliente`);
}
for (const dele of ["naturaspanyc.com", "www.naturaspanyc.com", "guileoai.com.br", "notguileoai.com",
  "guileoai.com.evil.com", "pages.dev.evil.com", "xguileoai.com", "localhost.evil.com"]) {
  ok(ehNosso(dele) === false, `PLANTADO parecido-mas-não-é-nosso: ${dele}`);
}
igual(hostDeCliente("WWW.NaturaSpaNYC.com"), "www.naturaspanyc.com", "host de cliente sai normalizado");
ok(ehNosso("apelido.com", ["apelido.com"]) === true, "apelido via GUILEO_HOSTS é nosso");
ok(ehNosso("www.apelido.com", ["apelido.com"]) === true, "apelido com www também");
ok(ehNosso("outro.com", ["apelido.com"]) === false, "PLANTADO GUILEO_HOSTS não libera outro host");

// ── 2. CAMINHOS NUM DOMÍNIO DE CLIENTE ───────────────────────────────────────────────────────
secao("rotas do cliente");
const S = "natura-spa";
igual(rotaDoCliente("/", S).tipo, "pagina", "/ é a página do cliente");
igual(rotaDoCliente("/", S).unidade, null, "/ não é página de unidade");
for (const [c, id] of [["/astoria", "astoria"], ["/upper-east-side", "ues"], ["/med-spa-ues", "med"]]) {
  const r = rotaDoCliente(c, S);
  ok(r.tipo === "pagina" && r.unidade?.id === id, `${c} é a página da unidade ${id}`);
}
for (const negado of ["/admin", "/portal", "/sales", "/vendedor", "/planos", "/novo/natura-spa", "/novo/clareza-dental",
  "/novo/natura-spa-porta", "/site/natura-spa", "/blog", "/for/dentists", "/index.html", "/astoria/extra",
  "/brooklyn", "/manifest.webmanifest", "/sw.js", "/.well-known/x", "/novo/natura-spa/v3/pagina.html",
  "/assets/../admin", "/api", "/novo/natura-spa/book", "/astoria.html"]) {
  igual(rotaDoCliente(negado, S).tipo, "negado", `PLANTADO ${negado} recusado no domínio do cliente`);
}
igual(rotaDoCliente("/astoria", "slug-que-nao-existe").tipo, "negado", "PLANTADO unidade de vitrine inexistente recusada");
igual(rotaDoCliente("/assets/index-abc123.js", S).tipo, "estatico", "/assets/* passa");
igual(rotaDoCliente("/novo/natura-spa/v3/hero.webp", S).tipo, "estatico", "mídia da vitrine passa");
igual(rotaDoCliente("/novo/natura-spa/v3/hero.mp4", S).tipo, "estatico", "vídeo da vitrine passa");
igual(rotaDoCliente("/api/lead-vitrine", S).tipo, "api", "/api/* passa");
igual(rotaDoCliente("/robots.txt", S).tipo, "robots", "robots.txt é do host");
igual(rotaDoCliente("/sitemap.xml", S).tipo, "sitemap", "sitemap.xml é do host");
ok(ehEstatico("/novo/natura-spa") === false, "PLANTADO página /novo/<slug> não é estático");
ok(ehEstatico("/novo/natura-spa/v3/x.js") === false, "PLANTADO .js fora de /assets não é estático");
igual(unidadeDoCaminho(S, "/astoria/")?.id, "astoria", "barra final resolve a mesma unidade");

// ── 3. OS FATOS DO SERVIDOR BATEM COM A PÁGINA ───────────────────────────────────────────────
secao("sincronia com src/novo/NaturaSpa.jsx");
const V = VITRINES[S];
const pagina = readFileSync(raiz(V.fonte), "utf8");
const tem = (trecho, msg) => ok(pagina.includes(trecho), `${msg} — não achei na página: ${String(trecho).slice(0, 70)}`);
tem(`const TITULO = ${JSON.stringify(V.titulo)};`, "título");
tem(`const DESCRICAO = ${JSON.stringify(V.descricao)};`, "descrição");
tem(`const EMAIL = ${JSON.stringify(V.email)};`, "e-mail");
tem(`const B = ${JSON.stringify(V.arquivos)};`, "pasta de arquivos");
tem(`const ORDEM = ${JSON.stringify(V.unidades.map((u) => u.id)).replace(/,/g, ", ")};`, "ordem e quantidade das unidades");
V.redes.forEach((r) => tem(`"${r}"`, "rede social"));
for (const u of V.unidades) {
  tem(`id: "${u.id}", curto: "${u.curto}"`, `${u.id}: id + nome curto`);
  igual(u.caminho, caminhoDe(u.curto), `${u.id}: caminho nasce do nome curto da página`);
  tem(`marca: ${JSON.stringify(u.marca)}`, `${u.id}: marca`);
  tem(`texto: ${JSON.stringify(u.texto)}`, `${u.id}: texto`);
  tem(`rua: ${JSON.stringify(u.rua)}, cidade: ${JSON.stringify(u.cidade)}`, `${u.id}: endereço`);
  tem(`tel: "${u.tel}"`, `${u.id}: telefone`);
  tem(`semana: [${u.semana.join(", ")}], dom: [${u.dom.join(", ")}]`, `${u.id}: horário`);
  tem(`geo: [${u.geo.join(", ")}]`, `${u.id}: coordenadas`);
  tem(`reservar: "${u.reservar}"`, `${u.id}: link de reserva`);
  tem(`fotos: [["${u.foto}"`, `${u.id}: primeira foto`);
  ok(existsSync(raiz(`public${V.arquivos}/${u.foto}.webp`)), `${u.id}: a foto existe em public/`);
}
ok(existsSync(raiz(`public${V.arquivos}/${V.capa}`)), "a capa (og:image) existe em public/");
V.faq.forEach(([q, a]) => tem(`[${JSON.stringify(q)}, ${JSON.stringify(a)}]`, "FAQ"));
igual((pagina.match(/^ {2}\["[^\n]*\?", "/gm) || []).length >= V.faq.length, true, "a página não tem MENOS perguntas que o servidor");
ok(!pagina.includes("PLANTADO-telefone-que-nao-existe"), "controle: o `tem` reprova o que não está na página");
igual(new Set(V.unidades.map((u) => u.caminho)).size, V.unidades.length, "caminhos de unidade são únicos");

// A prévia em guileoai.com/novo/natura-spa publica EXATAMENTE o grafo de antes desta mudança.
igual(createHash("sha256").update(JSON.stringify(ldVitrine(S, { previa: true }))).digest("hex"),
  "2c29b483da0831a5451d83ef70fc4e5095aa8569e94a2d6aefd179143837918b", "JSON-LD da prévia é byte a byte o de antes");

// ── 4. CABEÇA NO DOMÍNIO DO CLIENTE ──────────────────────────────────────────────────────────
secao("cabeça");
const H = "www.naturaspanyc.com";
const home = cabecaDoCliente({ slug: S, host: H, indexable: true });
igual(home.canonical, `https://${H}/`, "canonical da raiz no host do cliente");
igual(home.titulo, V.titulo, "título da raiz é o deles");
igual(home.robots, "index, follow, max-image-preview:large, max-snippet:-1", "indexable=true → index");
igual(cabecaDoCliente({ slug: S, host: H, indexable: false }).robots, "noindex, nofollow", "indexable=false → noindex");
igual(robotsDe(undefined), "noindex, nofollow", "PLANTADO indexable ausente é noindex");
igual(robotsDe("true"), "noindex, nofollow", "PLANTADO indexable texto não vira index");
igual(home.ld["@graph"].length, 4, "raiz: 3 unidades + FAQPage");
ok(home.ld["@graph"].slice(0, 3).every((n, i) => n.url === `https://${H}/${V.unidades[i].caminho}` && n["@id"] === `https://${H}/#${V.unidades[i].id}`), "cada unidade aponta para a própria página, no host do cliente");
ok(!JSON.stringify(home).toLowerCase().includes("guileo"), "PLANTADO nada de 'guileo' na cabeça do cliente");
const ast = cabecaDoCliente({ slug: S, host: H, indexable: true, unidade: "astoria" });
igual(ast.canonical, `https://${H}/astoria`, "canonical da unidade");
igual(ast.titulo, "Natura Spa + Salon · Astoria | 30-79 Steinway Street, Astoria, NY 11103", "título da unidade = marca + endereço");
igual(ast.ld["@graph"].length, 1, "página de unidade: só o LocalBusiness dela");
igual(ast.ld["@graph"][0].address.postalCode, "11103", "CEP da unidade");
igual(ast.ld["@graph"][0].telephone, "+17189565530", "telefone da unidade");
ok(new Set(V.unidades.map((u) => cabecaDoCliente({ slug: S, host: H, unidade: u.id }).titulo)).size === 3, "três títulos diferentes para três unidades");
igual(cabecaDoCliente({ slug: S, host: H, unidade: "brooklyn" }), null, "PLANTADO unidade inexistente não tem cabeça");
igual(cabecaDoCliente({ slug: "outro", host: H }), null, "PLANTADO vitrine sem registro não tem cabeça");
igual(cabecaDoCliente({ slug: S, host: "x.com/abc" }), null, "PLANTADO host com caminho não tem cabeça");
igual(cabecaDoCliente({ slug: S, host: "x.com:8080" }), null, "PLANTADO host com porta não tem cabeça");

// ── 5. REESCRITA DO <head> NA CASCA DE VERDADE ───────────────────────────────────────────────
secao("reescrita do head");
const cascas = ["dist/index.html", "index.html"].filter((p) => existsSync(raiz(p)));
ok(cascas.length > 0, "existe pelo menos uma casca para testar");
const cabecaDe = (html) => html.slice(html.search(/<head[^>]*>/i), html.search(/<\/head>/i));
const conta = (s, re) => (s.match(re) || []).length;
const boot = bootDoCliente({ host: H, kind: "vitrine", slug: S, indexable: true, pixel_meta: "123456789012345", tag_google: "g-abc1234567", client_email: "dona@cliente.com" });
for (const arq of cascas) {
  const casca = readFileSync(raiz(arq), "utf8");
  const antes = cabecaDe(casca);
  ok(/guileo/i.test(antes) && antes.includes("data-guileo-global"), `${arq}: controle — a casca original É da Guileo`);
  const saida = reescreverCabeca(casca, home, boot);
  ok(typeof saida === "string", `${arq}: reescreveu`);
  const head = cabecaDe(saida);
  ok(!/guileo/i.test(head), `${arq}: PLANTADO zero 'guileo' no head do cliente${/guileo/i.test(head) ? " — sobrou: " + head.match(/.{0,50}guileo.{0,50}/i)[0] : ""}`);
  igual(conta(head, /<title>/g), 1, `${arq}: um <title>`);
  ok(head.includes(`<title>Brazilian Hair Salon &amp; Spa Astoria and UES, NY | Natura Spa</title>`), `${arq}: título do cliente`);
  igual(conta(head, /rel="canonical"/g), 1, `${arq}: um canonical`);
  ok(head.includes(`<link rel="canonical" href="https://${H}/" />`), `${arq}: canonical no host do cliente`);
  igual(conta(head, /name="robots"/g), 1, `${arq}: um robots`);
  igual(conta(head, /name="description"/g), 1, `${arq}: uma description`);
  igual(conta(head, /property="og:url"/g), 1, `${arq}: um og:url`);
  igual(conta(head, /application\/ld\+json/g), 1, `${arq}: um JSON-LD — o do cliente`);
  igual(conta(head, /hreflang|rel="manifest"|apple-touch-icon|name="theme-color"|name="keywords"|name="author"|<!--/g), 0, `${arq}: hreflang, manifesto, ícones, metas e comentários da Guileo saíram`);
  igual(conta(head, /http-equiv="Content-Security-Policy"/g), conta(antes, /http-equiv="Content-Security-Policy"/g), `${arq}: a CSP ficou`);
  igual(conta(head, /<script\b[^>]*type="module"/g), conta(antes, /<script\b[^>]*type="module"/g), `${arq}: os scripts do app ficaram`);
  igual(conta(head, /rel="(stylesheet|modulepreload)"/g), conta(antes, /rel="(stylesheet|modulepreload)"/g), `${arq}: os estilos do app ficaram`);
  igual(saida.slice(saida.search(/<\/head>/i)), casca.slice(casca.search(/<\/head>/i)), `${arq}: nada depois do </head> mudou`);
  const ld = JSON.parse(head.match(/<script type="application\/ld\+json" id="tenant-ld">([\s\S]*?)<\/script>/)[1]);
  igual(ld["@graph"].filter((n) => n.address).length, 3, `${arq}: 3 LocalBusiness no HTML cru`);
  const b = JSON.parse(head.match(/<script type="application\/json" id="tenant-boot">([\s\S]*?)<\/script>/)[1]);
  ok(b.slug === S && b.host === H && b.indexable === true && b.pixelMeta === "123456789012345" && b.tagGoogle === "G-ABC1234567", `${arq}: bloco tenant-boot completo`);
  ok(!head.includes("dona@cliente.com"), `${arq}: PLANTADO e-mail do cliente não vaza no HTML`);
  ok(!/<script(?![^>]*\b(type="(module|application\/(ld\+)?json)"|src=))[^>]*>/i.test(head), `${arq}: nenhum script inline executável (a CSP bloquearia)`);
  const unid = reescreverCabeca(casca, ast, boot);
  ok(cabecaDe(unid).includes(`<link rel="canonical" href="https://${H}/astoria" />`), `${arq}: canonical da unidade`);
}
const hostil = reescreverCabeca("<html><head><title>x</title></head><body></body></html>",
  { ...home, titulo: `a</title><script>alert(1)</script>`, descricao: `"><img src=x>`, ld: { x: "</script><script>alert(2)</script>" } }, { slug: "</script>" });
ok(!hostil.includes("<script>alert") && !hostil.includes(`"><img`), "PLANTADO valor hostil não fecha tag nem atributo");
igual(reescreverCabeca("<html><body>sem head</body></html>", home, boot), null, "PLANTADO casca sem <head> → null (vira 503, nunca casca crua)");
ok(jsonSeguro({ a: "</script>" }).includes("\\u003c/script>"), "jsonSeguro escapa <");
igual(bootDoCliente({ host: H, slug: S, pixel_meta: "abc<script>", tag_google: "UA-1" }).pixelMeta, "", "PLANTADO pixel malformado vira vazio");
igual(bootDoCliente({ host: H, slug: S, pixel_meta: "abc<script>", tag_google: "UA-1" }).tagGoogle, "", "PLANTADO tag malformada vira vazia");

// ── 6. robots.txt e sitemap.xml ──────────────────────────────────────────────────────────────
secao("robots e sitemap");
const rbt = robotsTxtDoCliente({ host: H, indexable: true });
ok(rbt.includes(`Sitemap: https://${H}/sitemap.xml`) && rbt.includes("Disallow: /api/") && !/guileo/i.test(rbt), "robots do cliente aponta para o sitemap DELE");
ok(!robotsTxtDoCliente({ host: H, indexable: false }).includes("Sitemap:"), "não indexável: robots sem sitemap");
const sm = sitemapDoCliente({ slug: S, host: H, indexable: true });
igual(conta(sm, /<loc>/g), 4, "sitemap: raiz + 3 unidades");
for (const u of ["/", "/astoria", "/upper-east-side", "/med-spa-ues"]) ok(sm.includes(`<loc>https://${H}${u}</loc>`), `sitemap lista ${u}`);
ok(!/guileo/i.test(sm), "PLANTADO sitemap do cliente não cita guileo");
igual(conta(sitemapDoCliente({ slug: S, host: H, indexable: false }), /<loc>/g), 0, "PLANTADO não indexável → sitemap vazio");
igual(sitemapDoCliente({ slug: S, host: "x.com/a" }), null, "PLANTADO sitemap para host inválido não existe");

// ── 7. O MIDDLEWARE, DE PONTA A PONTA (sem rede: fetch é um dublê) ───────────────────────────
secao("middleware");
const CASCA = readFileSync(raiz(cascas[0]), "utf8");
const SEGREDO = "segredo-de-teste-0123456789";
const LINHAS = {
  "naturaspanyc.com": { host: H, client_email: "dona@cliente.com", kind: "vitrine", slug: S, active: true, indexable: true, pixel_meta: "123456789012345", tag_google: null },
  "previa-fechada.com": { host: "previa-fechada.com", client_email: "a@b.com", kind: "vitrine", slug: S, active: true, indexable: false },
  "troca.com": { host: "www.outro-cliente.com", client_email: "x@y.com", kind: "vitrine", slug: S, active: true, indexable: true },
  "gerado.com": { host: "gerado.com", client_email: "x@y.com", kind: "site", slug: "algum-site", active: true, indexable: true },
  "sem-cabeca.com": { host: "sem-cabeca.com", client_email: "x@y.com", kind: "vitrine", slug: "clareza-dental", active: true, indexable: true },
  "inativo.com": { host: "inativo.com", client_email: "x@y.com", kind: "vitrine", slug: S, active: false, indexable: true },
};
let consultas = [];
const fetchReal = globalThis.fetch;
globalThis.fetch = async (u, init) => {
  const corpo = JSON.parse(init?.body || "{}");
  consultas.push({ url: String(u), host: corpo.p_host, segredo: corpo.p_secret });
  const r = semWww(String(corpo.p_host || ""));
  if (r === "banco-caiu.com") return new Response("boom", { status: 500 });
  if (r === "sem-permissao.com") return new Response(`{"message":"permission denied"}`, { status: 401 });
  return new Response(JSON.stringify(LINHAS[r] ?? null), { status: 200, headers: { "content-type": "application/json" } });
};
const HSTS_NOSSO = "max-age=63072000; includeSubDomains; preload";
const HEADERS_PAGES = { "content-type": "text/html; charset=utf-8", etag: `"abc"`, "x-frame-options": "DENY", "content-security-policy": "default-src 'self'", "strict-transport-security": HSTS_NOSSO };
function ctx(u, { method = "GET", headers = {}, env = { INGEST_SECRET: SEGREDO }, proximo } = {}) {
  const chamadas = [];
  return {
    chamadas,
    request: new Request(u, { method, headers, body: method === "POST" ? "{}" : undefined }),
    env,
    next: async (req) => {
      chamadas.push(req || null);
      if (proximo) return proximo(req);
      return new Response(CASCA, { status: 200, headers: HEADERS_PAGES });
    },
  };
}
const le = async (res) => ({ status: res.status, headers: [...res.headers].sort().join("|"), corpo: await res.text() });

// 7a. HOST NOSSO: a resposta é a do `legado`, e nada mais acontece (sem env, sem banco).
const envProibida = new Proxy({}, { get(_t, k) { throw new Error(`env.${String(k)} lida num host nosso`); } });
const NOSSOS_URLS = ["https://guileoai.com", "https://www.guileoai.com", "https://abc.guileoai.pages.dev", "http://localhost:8788", "http://127.0.0.1:8788"];
const CAMINHOS = ["/", "/planos", "/planos?lang=pt", "/pulse", "/portal", "/admin", "/novo/natura-spa", "/site/x", "/nao-existe",
  "/lorem.html", "/index.html", "/assets/falta.js", "/robots.txt", "/sitemap.xml", "/api/lead", "/astoria", "/upper-east-side", "/presente/x"];
let iguais = 0;
for (const base of NOSSOS_URLS) for (const c of CAMINHOS) for (const method of ["GET", "HEAD", "POST"]) {
  consultas = [];
  const a = await le(await onRequest(ctx(base + c, { method, env: envProibida })));
  const b = await le(await legado(ctx(base + c, { method, env: envProibida })));
  const mesmo = a.status === b.status && a.headers === b.headers && a.corpo === b.corpo && consultas.length === 0;
  if (mesmo) iguais++; else ok(false, `host nosso mudou: ${method} ${base}${c}`);
}
igual(iguais, NOSSOS_URLS.length * CAMINHOS.length * 3, "host NOSSO: toda resposta é idêntica à do legado, sem ler env nem banco");
ok((await le(await onRequest(ctx("https://guileoai.com/astoria")))).status === 404, "PLANTADO guileoai.com/astoria segue 404 (rota só existe no domínio do cliente)");

// 7b. O gancho de prova só abre com o segredo.
for (const [nome, headers] of [
  ["sem segredo", { "x-guileo-host": H }],
  ["segredo errado", { "x-guileo-host": H, "x-guileo-secret": "errado" }],
  ["segredo com 1 letra a menos", { "x-guileo-host": H, "x-guileo-secret": SEGREDO.slice(0, -1) }],
  ["segredo certo, host nosso", { "x-guileo-host": "www.guileoai.com", "x-guileo-secret": SEGREDO }],
  ["segredo certo, host malformado", { "x-guileo-host": "naturaspanyc.com/x", "x-guileo-secret": SEGREDO }],
]) {
  consultas = [];
  const a = await le(await onRequest(ctx("https://guileoai.com/", { headers })));
  const b = await le(await legado(ctx("https://guileoai.com/")));
  ok(a.corpo === b.corpo && a.status === b.status && a.headers === b.headers && consultas.length === 0, `PLANTADO x-guileo-host ignorado: ${nome}`);
}
consultas = [];
ok((await le(await onRequest(ctx("https://guileoai.com/", { headers: { "x-guileo-host": H, "x-guileo-secret": "" }, env: {} })))).corpo === CASCA, "PLANTADO sem INGEST_SECRET na env o gancho não abre nem com segredo vazio");

consultas = [];
let r = await onRequest(ctx("https://guileoai.com/", { headers: { "x-guileo-host": H, "x-guileo-secret": SEGREDO } }));
let t = await r.text();
ok(r.status === 200 && t.includes(`<link rel="canonical" href="https://${H}/" />`) && !/guileo/i.test(cabecaDe(t)), "prova com segredo: página do cliente, canonical no host dele");
igual(r.headers.get("cache-control"), "no-store", "prova: resposta nunca cacheável (o endereço é guileoai.com)");
igual(r.headers.get("etag"), null, "etag da casca não acompanha o HTML reescrito");
igual(r.headers.get("x-frame-options"), "DENY", "cabeçalhos de segurança da casca ficam");
igual(r.headers.get("x-robots-tag"), null, "indexável: sem X-Robots-Tag");
ok(consultas.length === 1 && consultas[0].url.endsWith("/rpc/domain_lookup") && consultas[0].segredo === SEGREDO, "a linha veio de domain_lookup, com o segredo");
r = await onRequest(ctx("https://guileoai.com/astoria", { method: "HEAD", headers: { "x-guileo-host": H, "x-guileo-secret": SEGREDO } }));
ok(r.status === 200 && (await r.text()) === "", "prova: HEAD numa página de unidade → 200 sem corpo");
ok(consultas.length === 1, "segunda consulta ao mesmo host saiu do cache (nenhuma ida nova ao banco)");

// 7c. No domínio do cliente.
r = await onRequest(ctx(`https://${H}/`, { headers: { "if-none-match": `"abc"` } }));
t = await r.text();
ok(r.status === 200 && t.includes("tenant-boot") && t.includes(V.titulo.replace("&", "&amp;")), "domínio do cliente: / serve a página dele");
igual(r.headers.get("cache-control"), "public, max-age=0, must-revalidate", "domínio do cliente: revalida sempre");
igual(r.headers.get("strict-transport-security"), "max-age=31536000", "PLANTADO HSTS no domínio do cliente não alcança os subdomínios dele");
igual((await onRequest(ctx("https://guileoai.com/"))).headers.get("strict-transport-security"), HSTS_NOSSO, "em guileoai.com o HSTS segue o de sempre");
r = await onRequest(ctx(`https://${H}/upper-east-side`));
t = await r.text();
ok(r.status === 200 && t.includes(`<link rel="canonical" href="https://${H}/upper-east-side" />`) && t.includes("842 Lexington Ave"), "página de unidade: canonical e endereço próprios no HTML cru");
for (const c of ["/admin", "/portal", "/sales", "/novo/clareza-dental", "/novo/natura-spa", "/planos", "/site/natura-spa", "/brooklyn"]) {
  const x = await le(await onRequest(ctx(`https://${H}${c}`)));
  ok(x.status === 404 && !x.corpo.includes('id="root"') && !/guileo/i.test(x.corpo), `PLANTADO ${c} no domínio do cliente → 404 sem a casca`);
}
r = await onRequest(ctx(`https://${H}/astoria/`));
ok(r.status === 301 && r.headers.get("location") === `https://${H}/astoria`, "barra final → 301 para o endereço único");
r = await onRequest(ctx(`https://${H}/Astoria`));
ok(r.status === 301 && r.headers.get("location") === `https://${H}/astoria`, "maiúscula → 301 para o endereço único");
r = await onRequest(ctx("https://naturaspanyc.com/astoria?x=1"));
ok(r.status === 301 && r.headers.get("location") === `https://${H}/astoria?x=1`, "apex → 301 para o host canônico da linha");
r = await onRequest(ctx(`https://${H}/robots.txt`));
ok(r.status === 200 && (await r.text()).includes(`Sitemap: https://${H}/sitemap.xml`), "robots.txt do host do cliente");
r = await onRequest(ctx(`https://${H}/sitemap.xml`));
ok(r.status === 200 && r.headers.get("content-type").includes("xml") && (await r.text()).includes(`<loc>https://${H}/med-spa-ues</loc>`), "sitemap.xml do host do cliente");
r = await onRequest(ctx(`https://${H}/`, { method: "POST" }));
igual(r.status, 405, "PLANTADO POST numa página do cliente → 405");

r = await onRequest(ctx("https://previa-fechada.com/"));
t = await r.text();
ok(r.status === 200 && t.includes(`<meta name="robots" content="noindex, nofollow" />`) && r.headers.get("x-robots-tag") === "noindex, nofollow", "indexable=false → noindex no HTML e no cabeçalho");

// 7d. Nunca a casa da Guileo (nem a de outro cliente) no domínio de um cliente.
for (const [h, status, porque] of [
  ["sem-linha.com", 404, "host sem linha"],
  ["inativo.com", 503, "linha inativa devolvida por engano não serve"],
  ["banco-caiu.com", 503, "banco fora"],
  ["sem-permissao.com", 503, "consulta sem permissão"],
  ["troca.com", 503, "a consulta devolveu a linha de OUTRO host"],
  ["gerado.com", 503, "kind 'site' ainda não tem cabeça de servidor"],
  ["sem-cabeca.com", 503, "vitrine sem registro em VITRINES"],
]) {
  const x = await le(await onRequest(ctx(`https://${h}/`)));
  ok(x.status === status && !x.corpo.includes('id="root"') && !/guileo/i.test(x.corpo) && x.headers.includes("no-store"), `PLANTADO ${porque} → ${status} liso, sem casca (veio ${x.status})`);
}
consultas = [];
await onRequest(ctx("https://banco-caiu.com/"));
igual(consultas.length, 1, "falha de consulta NÃO fica em cache (consulta de novo)");
consultas = [];
await onRequest(ctx("https://sem-linha.com/"));
igual(consultas.length, 0, "host sem linha fica em cache curto (não bate no banco a cada pedido)");

// 7e. Estático e /api/.
consultas = [];
const img = () => new Response("bytes", { status: 200, headers: { "content-type": "image/webp", "cache-control": "public, max-age=14400", "strict-transport-security": HSTS_NOSSO } });
r = await onRequest(ctx(`https://${H}/novo/natura-spa/v3/hero.webp`, { proximo: img }));
ok(r.status === 200 && r.headers.get("content-type") === "image/webp" && r.headers.get("cache-control") === "public, max-age=14400" && (await r.text()) === "bytes" && consultas.length === 0, "mídia passa direto, sem consultar o banco");
r = await onRequest(ctx("https://naturaspanyc.com/novo/natura-spa/v3/hero.webp", { proximo: img }));
igual(r.headers.get("strict-transport-security"), "max-age=31536000", "PLANTADO HSTS do estático no apex do cliente também é só do host");
r = await onRequest(ctx("https://banco-caiu.com/assets/index-abc.js", { proximo: () => new Response("js", { status: 200, headers: { "content-type": "text/javascript" } }) }));
igual(r.status, 200, "pedaço do app carrega mesmo com o banco fora");
r = await onRequest(ctx(`https://${H}/novo/natura-spa/v3/nao-existe.webp`));
ok(r.status === 404 && !(await r.text()).includes("root"), "PLANTADO mídia ausente → 404, nunca a casca da Guileo");
let c7 = ctx(`https://${H}/api/lead-vitrine`, { method: "POST", headers: { origin: `https://${H}`, referer: `https://${H}/astoria` }, proximo: () => new Response("ok") });
await onRequest(c7);
ok(c7.chamadas.length === 1 && c7.chamadas[0]?.headers.get("origin") === "https://guileoai.com" && c7.chamadas[0].headers.get("referer") === "https://guileoai.com/novo/natura-spa" && c7.chamadas[0].method === "POST", "/api no domínio do cliente: Origin do próprio host segue como o nosso");
c7 = ctx(`https://${H}/api/lead-vitrine`, { method: "POST", headers: { origin: "https://evil.com" }, proximo: () => new Response("ok") });
await onRequest(c7);
ok(c7.chamadas.length === 1 && c7.chamadas[0] === null, "PLANTADO Origin de outro site NÃO é trocado");
c7 = ctx(`https://${H}/api/lead-vitrine`, { method: "POST", headers: { origin: "https://www.naturaspanyc.com.evil.com" }, proximo: () => new Response("ok") });
await onRequest(c7);
ok(c7.chamadas[0] === null, "PLANTADO Origin parecido com o host do cliente NÃO é trocado");
c7 = ctx("https://sem-linha.com/api/lead-vitrine", { method: "POST", headers: { origin: "https://sem-linha.com" }, proximo: () => new Response("ok") });
r = await onRequest(c7);
ok(r.status === 404 && c7.chamadas.length === 0, "PLANTADO /api num host sem linha não chega à função");

globalThis.fetch = fetchReal;

if (falhas) { console.log(`\n❌ dominio: ${falhas} de ${total} verificações falharam`); process.exit(1); }
console.log(`✅ dominio: ${total} verificações · host nosso intocado · domínio de cliente só serve a linha dele`);
