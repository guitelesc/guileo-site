// SERVICE WORKER DO GUILEO APP (o cockpit do cliente, escopo /portal).
//
// Irmão do worker por tenant em functions/site/sw/[slug].js — mesmas travas, outro dono. Aquele é o
// app do NEGÓCIO do cliente; este é o app do DONO, onde ele vê agenda, ligações, clientes e
// dinheiro. Registrado com escopo "/portal" (ver Portal.jsx), então ele nunca controla a landing
// nem os sites de cliente em /site/*, que têm o worker deles.
//
// ── AS TRAVAS ───────────────────────────────────────────────────────────────────────────────────
//  1. /api/** É REDE PURA, SEMPRE. Nenhuma resposta de API entra no cache, nem é servida dele.
//     Um cockpit de cliente pagante mostrando o número de ontem com cara de hoje é pior que tela
//     em branco: ele toma decisão de dinheiro em cima de um número morto. O carimbo de "lido às
//     HH:MM" da tela Hoje é o caminho honesto para dado guardado — e ele é feito na tela, com o
//     horário à vista, não escondido aqui dentro.
//  2. SÓ A CASCA ESTÁTICA. Cacheamos o HTML da casca, os /assets/* (nome com hash, imutáveis),
//     o manifesto e os ícones. Mais nada.
//  3. NAVEGAÇÃO É REDE-PRIMEIRO. Assim um deploy novo nunca fica preso atrás de casca velha
//     apontando para um chunk que já não existe (o 404 de chunk que já mordeu esta casa).
//  4. NÃO ENCOSTAR NO QUE É DE OUTRO. /site/* (apps dos clientes) e qualquer outra origem passam
//     direto. CacheStorage é por ORIGEM: o activate só apaga caches com o NOSSO prefixo.
//  5. SEM REDE = TELA HONESTA, SEM NÚMERO. A página offline não inventa nem repete dado: diz que
//     está sem conexão e oferece tentar de novo.
const PREFIXO = "guileo-app-";
const CACHE = PREFIXO + "v1";
const CASCA = "/portal";
const ESSENCIAIS = ["/portal", "/manifest.webmanifest", "/guileo-app-192.png"];

const TXT = {
  pt: { off: "Você está sem conexão", corpo: "Seus números voltam assim que a internet voltar. Não mostramos número velho com cara de novo.", tentar: "Tentar de novo" },
  en: { off: "You're offline", corpo: "Your numbers come back as soon as you're connected. We don't show yesterday's number as if it were today's.", tentar: "Try again" },
  es: { off: "Estás sin conexión", corpo: "Tus números vuelven en cuanto tengas internet. No mostramos un número viejo como si fuera de hoy.", tentar: "Reintentar" },
  hi: { off: "आप ऑफ़लाइन हैं", corpo: "इंटरनेट आते ही आपके आँकड़े वापस आ जाएँगे। हम पुराने आँकड़े को आज का बताकर नहीं दिखाते।", tentar: "फिर कोशिश करें" },
};

function paginaOffline() {
  const t = TXT;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#161512">
<title>Guileo</title><style>
:root{color-scheme:dark}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#161512;
color:#EDE8DE;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;padding:32px;text-align:center}
.b{max-width:36ch}img{width:72px;height:72px;margin:0 0 18px}
h1{font-size:1.35rem;margin:0 0 12px;font-weight:800}
p{opacity:.72;line-height:1.6;margin:0 0 24px;font-size:.95rem}
button{padding:14px 26px;min-height:48px;border-radius:999px;border:0;background:#D6C29A;color:#161512;
font:inherit;font-size:16px;font-weight:700;cursor:pointer}
</style></head><body><div class="b">
<img src="/guileo-app-192.png" alt="">
<h1 id="t"></h1><p id="c"></p><button id="b" onclick="location.reload()"></button>
<script>
var T=${JSON.stringify(TXT)};
var l=(navigator.language||"en").slice(0,2);var t=T[l]||T.en;
document.getElementById("t").textContent=t.off;
document.getElementById("c").textContent=t.corpo;
document.getElementById("b").textContent=t.tentar;
document.documentElement.lang=T[l]?l:"en";
</script>
</div></body></html>`;
}
const OFFLINE = paginaOffline();

// Trava 2 + 4: o que este worker tem direito de guardar.
function meu(pathname) {
  if (pathname.startsWith("/site/")) return false;          // app de cliente: worker dele
  if (pathname.startsWith("/api/")) return false;           // Trava 1
  if (ESSENCIAIS.includes(pathname)) return true;
  if (pathname.startsWith("/assets/")) return true;         // js/css com hash no nome
  return pathname === "/guileo-app-512.png" || pathname === "/favicon.svg";
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ESSENCIAIS))
      .catch(() => { })                                     // rede ruim na instalação não quebra nada
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIXO) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function daRede(req, guardar) {
  const res = await fetch(req);
  if (guardar && res && res.status === 200 && res.type === "basic") {
    const copia = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => { });
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                         // toda escrita vai pra rede, sempre
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;          // terceiros: nunca
  if (url.pathname.startsWith("/api/")) return;             // Trava 1 — dado vivo, rede pura

  // Trava 3: navegação é rede-primeiro; sem rede, a casca guardada e, se nem ela existir, a
  // tela honesta de offline. A casca é só o esqueleto — os números dela vêm de /api/**, que
  // continua sendo rede pura, então o app offline nunca pinta um número velho sozinho.
  if (req.mode === "navigate") {
    e.respondWith(
      daRede(req, true).catch(() =>
        caches.match(CASCA).then((hit) => hit || new Response(OFFLINE, {
          status: 200, headers: { "content-type": "text/html; charset=utf-8" },
        }))
      )
    );
    return;
  }

  if (!meu(url.pathname)) return;                           // Trava 4
  e.respondWith(caches.match(req).then((hit) => hit || daRede(req, true).catch(() => Response.error())));
});
