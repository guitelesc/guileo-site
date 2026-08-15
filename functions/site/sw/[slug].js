// GET /site/sw/<slug>.js — O SERVICE WORKER DO APP DE UM CLIENTE.
//
// Cada negócio recebe o SEU service worker, gerado com o slug, o nome, a cor e o telefone dele
// cravados dentro. É o que faz o app abrir sem rede e é também a peça mais perigosa do PWA — um
// service worker mal escopado serve o conteúdo de um cliente na tela do cliente de outro.
//
// ── AS TRAVAS ───────────────────────────────────────────────────────────────────────────────────
//  1. ESCOPO POR SLUG, CONFERIDO DENTRO. O registro pede escopo /site/<slug> (por isso o cabeçalho
//     Service-Worker-Allowed abaixo), MAS o próprio worker ainda confere cada requisição: qualquer
//     caminho sob /site/ que não seja EXATAMENTE o deste slug passa direto para a rede, sem cache.
//     Escopo de service worker casa por PREFIXO de texto — "/site/natura" também casaria com
//     "/site/naturaspa". A conferência interna fecha essa porta por construção, não por sorte.
//  2. NUNCA CACHEAR /api/*. Preço, horário e agenda são dado VIVO. Um app que mostra preço velho é
//     pior que um app que não abre — o cliente final chega na loja com o número errado na mão.
//  3. NAVEGAÇÃO É REDE-PRIMEIRO. O casco (HTML) nunca vem do cache quando há rede, então um deploy
//     novo não fica preso atrás de um cache antigo (a armadilha do chunk 404 que já nos mordeu).
//  4. LIMPEZA SÓ DO PRÓPRIO PRATO. CacheStorage é por ORIGEM, compartilhado entre todos os slugs:
//     o activate só apaga caches com o prefixo deste slug. Apagar "todos os antigos" seria um
//     cliente derrubando o cache do outro.
//  5. SEM REDE = TELA HONESTA. Offline não mostra dado guardado: mostra o nome do negócio, a cor
//     dele e o botão de ligar (que funciona sem internet), dizendo que preços e horários só
//     aparecem online.
import { carregarSite, caminhos } from "../../lib/sitePwa.js";

const TXT = {
  pt: { off: "Você está sem conexão", corpo: "Assim que a internet voltar, tudo aparece de novo. Preços e horários só carregam online — não mostramos informação velha.", ligar: "Ligar agora", tentar: "Tentar de novo" },
  en: { off: "You're offline", corpo: "Everything comes back as soon as you're connected. Prices and hours only load online — we don't show stale information.", ligar: "Call now", tentar: "Try again" },
  es: { off: "Estás sin conexión", corpo: "Todo vuelve en cuanto tengas internet. Precios y horarios solo cargan en línea — no mostramos información vieja.", ligar: "Llamar ahora", tentar: "Reintentar" },
};

function paginaOffline(site) {
  const t = TXT[site.lang] || TXT.pt;
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const tel = site.telefone
    ? `<a href="tel:${esc(site.telefone)}">📞 ${esc(t.ligar)}</a>`
    : "";
  return `<!doctype html><html lang="${esc(site.lang)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${esc(site.cor)}">
<title>${esc(site.nome)}</title><style>
:root{color-scheme:light}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:${esc(site.cor)};color:#fff;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;padding:32px;text-align:center}
.b{max-width:34ch}h1{font-size:1.5rem;margin:0 0 12px;font-weight:700}
p{opacity:.9;line-height:1.55;margin:0 0 24px}
a,button{display:inline-block;margin:6px;padding:13px 24px;border-radius:999px;border:0;background:#fff;color:${esc(site.cor)};
font:inherit;font-weight:650;text-decoration:none;cursor:pointer}
</style></head><body><div class="b">
<h1>${esc(site.nome)}</h1><p><strong>${esc(t.off)}.</strong><br>${esc(t.corpo)}</p>
${tel}<button onclick="location.reload()">${esc(t.tentar)}</button>
</div></body></html>`;
}

function corpoDoWorker(site) {
  const p = caminhos(site.slug);
  const j = JSON.stringify;
  return `// Service worker de ${site.nome} — gerado por /site/sw/${site.slug}.js. Não edite: é derivado do cockpit.
const SLUG = ${j(site.slug)};
const CASCA = ${j(p.inicio)};
const PREFIXO = "guileo-site-" + SLUG + "-";
const CACHE = PREFIXO + "v1";
const OFFLINE = ${j(paginaOffline(site))};
const MEUS = new Set([${j(p.inicio)}, ${j(p.manifest)}, ${j(p.icone192)}, ${j(p.icone512)}]);

// Trava 1: este worker só toca no que é DESTE negócio (e no casco compartilhado do app).
function meu(pathname) {
  if (MEUS.has(pathname)) return true;
  if (pathname.startsWith("/site/")) return false;          // qualquer outro slug: fora
  return pathname.startsWith("/assets/");                   // js/css com hash no nome, imutável
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll([CASCA, ${j(p.icone192)}]))
      .catch(() => {})                                      // rede ruim na instalação não quebra nada
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      // Trava 4: só os caches DESTE slug. O CacheStorage é compartilhado com os outros clientes.
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIXO) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function daRede(req, guardar) {
  const res = await fetch(req);
  if (guardar && res && res.status === 200 && res.type === "basic") {
    const copia = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;          // terceiros: nunca
  if (url.pathname.startsWith("/api/")) return;             // Trava 2: dado vivo nunca é cacheado
  if (!meu(url.pathname)) return;                           // Trava 1

  // Trava 3: o HTML vem da rede quando há rede. Sem rede, a tela honesta de offline.
  if (req.mode === "navigate") {
    e.respondWith(
      daRede(req, true).catch(() =>
        new Response(OFFLINE, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })
      )
    );
    return;
  }

  // Casco e ícones: cache primeiro (nomes com hash / arquivos estáveis), rede como reserva.
  e.respondWith(
    caches.match(req).then((hit) => hit || daRede(req, true).catch(() => Response.error()))
  );
});
`;
}

export async function onRequestGet(context) {
  const bruto = String(context.params.slug || "").toLowerCase();
  const slug = bruto.replace(/\.js$/, "");
  if (slug === bruto) return new Response("// extensão esperada: .js", { status: 404, headers: { "content-type": "text/javascript; charset=utf-8" } });

  const site = await carregarSite(slug);
  // Site não publicado → 404. Sem service worker, não há app: nada de casca com a marca de um
  // negócio que ainda não está no ar.
  if (!site) return new Response("// site não publicado", { status: 404, headers: { "content-type": "text/javascript; charset=utf-8" } });

  return new Response(corpoDoWorker(site), {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      // O arquivo mora em /site/sw/, então por padrão só poderia controlar /site/sw/*. Este
      // cabeçalho é o que permite registrá-lo com escopo /site/<slug> — e a conferência interna
      // do worker é quem garante que ele não use um milímetro a mais do que precisa.
      "service-worker-allowed": "/site/",
      // Nunca servir um worker velho: ele é quem decide o que o app inteiro enxerga.
      "cache-control": "no-cache, max-age=0, must-revalidate",
      "x-content-type-options": "nosniff",
    },
  });
}

export const onRequest = (c) => (c.request.method === "GET" ? onRequestGet(c) : new Response("method not allowed", { status: 405 }));
