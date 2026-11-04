// Pages middleware — per-route SEO meta in the RAW HTML (social crawlers don't run JS).
// The SPA sets titles client-side via useSeo(), but WhatsApp/Facebook/Google-first-pass read the
// static shell, which carries the HOMEPAGE title + canonical on every route. This mirrors each
// page's useSeo() values server-side via the same battle-tested rewriteOg() text pass used by
// /for/* and /blog/*. Those two route families have their own functions — they are NOT in this
// map, so nothing is processed twice. /api/* and non-HTML pass through untouched.
import { rewriteOg, langFromUrl, pick, SITE } from "./lib/ogMeta.js";
import { safeEq } from "./lib/guard.js";
import { svcJson } from "./lib/sb.js";
import { signOg } from "./lib/signOg.js";
import { projetoOg, cartaoFixoOg, CARTAO_NATURA_SETUP } from "./lib/projetoOg.js";
import {
  ehNosso, hostDeCliente, normalizarHost, semWww, ehEstatico, rotaDoCliente, cabecaDoCliente,
  reescreverCabeca, robotsTxtDoCliente, sitemapDoCliente, bootDoCliente, VITRINES, NOSSO_SITE,
} from "./lib/dominio.js";

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// DOMÍNIO PRÓPRIO DO CLIENTE (2026-09-30)
//
// O mesmo projeto do Pages passa a responder por domínios de CLIENTE. A decisão é pelo host:
//
//   host NOSSO (guileoai.com, www, *.pages.dev, localhost)  → `legado(context)`, que é o
//     onRequest de sempre, intocado. Nada abaixo roda. É o primeiro `return` do onRequest.
//   host de CLIENTE → a linha ATIVA dele em tenant_domains (db/dominios.sql) decide tudo:
//     "/" e as páginas de unidade servem a casca com o <head> DELE, reescrito aqui no servidor;
//     /robots.txt e /sitemap.xml são gerados para o host dele; estático e /api/ seguem; qualquer
//     outra rota da Guileo (/portal, /admin, /novo/<outro>…) é 404 — nunca a nossa casa na dele.
//
// TRÊS TRAVAS
//   1. Sem linha ativa → 404 liso. Falha ao consultar → 503 liso. NUNCA o site da Guileo no
//      domínio do cliente (seria conteúdo duplicado com a nossa marca no endereço dele).
//   2. A linha só vale se o host dela for o host pedido — uma linha nunca serve outro domínio.
//   3. PROVA ANTES DO DNS: `x-guileo-host: www.cliente.com` escolhe o host SÓ quando o pedido
//      chega num host nosso E traz `x-guileo-secret` igual a env.INGEST_SECRET (comparação de
//      tempo constante). Sem o segredo o cabeçalho é ignorado e a resposta é a de sempre.
//
// Hosts nossos extras (um apelido futuro do projeto): env GUILEO_HOSTS="a.com,b.com".
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const hostsExtras = (env) => String(env?.GUILEO_HOSTS || "").split(",").map((s) => s.trim()).filter(Boolean);

// null → o pedido é NOSSO. Senão { host, prova }: host de cliente (null se malformado).
function alvoDoPedido(context) {
  const { request, env } = context;
  let hostUrl = "";
  try { hostUrl = new URL(request.url).hostname; } catch { /* host vazio cai em "não é nosso" */ }
  // Host nosso da lista fixa: decide sem ler env nenhuma. A env só é lida para um host que não
  // está na lista (apelido em GUILEO_HOSTS) ou quando o pedido traz o cabeçalho de prova.
  if (ehNosso(hostUrl) || ehNosso(hostUrl, hostsExtras(env))) {
    const pedido = request.headers.get("x-guileo-host");
    if (!pedido) return null;
    const certo = String(env?.INGEST_SECRET || "");
    if (!certo || !safeEq(request.headers.get("x-guileo-secret") || "", certo)) return null;
    const h = hostDeCliente(pedido, hostsExtras(env));
    return h ? { host: h, prova: true } : null;
  }
  return { host: normalizarHost(hostUrl), prova: false };
}

const liso = (status, texto, extra = {}) => new Response(`${texto}\n`, {
  status,
  headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", ...extra },
});
const fora = () => liso(503, "Temporarily unavailable. Please try again in a minute.", { "retry-after": "60" });

// ── A LINHA DO DOMÍNIO, COM CACHE ────────────────────────────────────────────────────────────
// Achou: 5 min. Não achou: 1 min (o dia do go-live não espera 5 min pela linha nova). Erro: nunca
// guardado. Duas camadas: memória do isolate (grátis) e Cache API (vale entre isolates).
// Se o banco falhar e a memória ainda tiver uma linha boa de até 1 h, ela serve — site de cliente
// no ar não cai por um soluço do banco. Sem linha boa na memória, falha = 503.
const TTL_SIM = 300;
const TTL_NAO = 60;
const VELHO_MAX_MS = 3600 * 1000;
const MEMORIA = new Map();
const chaveDoCache = (raiz) => new Request(`https://tenant-domains.invalid/v1/${raiz}`);

async function buscarDominio(context, host) {
  const raiz = semWww(host);
  const agora = Date.now();
  const m = MEMORIA.get(raiz);
  if (m && m.ate > agora) return m.val;

  const cache = typeof caches !== "undefined" && caches.default ? caches.default : null;
  if (cache) {
    try {
      const c = await cache.match(chaveDoCache(raiz));
      if (c) {
        const val = await c.json();
        if (val && (val.estado === "ok" || val.estado === "nao")) {
          MEMORIA.set(raiz, { val, ate: agora + (val.estado === "ok" ? TTL_SIM : TTL_NAO) * 1000, em: agora });
          return val;
        }
      }
    } catch { /* cache é atalho; a consulta abaixo é a verdade */ }
  }

  const r = await svcJson(context.env, "domain_lookup", { p_secret: context.env?.INGEST_SECRET || "", p_host: host });
  let val;
  if (r === null) {
    val = { estado: "nao" };
  } else if (r && typeof r === "object" && r.active === true && typeof r.host === "string"
    && semWww(normalizarHost(r.host) || "") === raiz) {
    // Só o que a página precisa. O e-mail do cliente não sai do banco para o cache.
    val = { estado: "ok", linha: { host: normalizarHost(r.host), kind: String(r.kind || ""), slug: String(r.slug || ""), indexable: r.indexable === true, pixel_meta: r.pixel_meta || null, tag_google: r.tag_google || null } };
  } else {
    // Erro de transporte, 401, resposta torta, ou linha de OUTRO host: nada disso é "não existe".
    if (m && m.val?.estado === "ok" && agora - m.em < VELHO_MAX_MS) return m.val;
    return { estado: "erro" };
  }

  const ttl = val.estado === "ok" ? TTL_SIM : TTL_NAO;
  MEMORIA.set(raiz, { val, ate: agora + ttl * 1000, em: agora });
  if (cache) {
    try {
      const guardar = cache.put(chaveDoCache(raiz), new Response(JSON.stringify(val), {
        headers: { "content-type": "application/json", "cache-control": `public, max-age=${ttl}` },
      }));
      if (context.waitUntil) context.waitUntil(guardar.catch(() => {})); else await guardar;
    } catch { /* sem cache a consulta só se repete */ }
  }
  return val;
}

// O HSTS do public/_headers diz `includeSubDomains; preload`. Em guileoai.com é o certo. No domínio
// de um CLIENTE não é decisão nossa: ele pode ter mail.cliente.com ou agenda.cliente.com em outro
// servidor, e esse cabeçalho (visto no apex) obrigaria HTTPS em todos eles por dois anos. No host
// do cliente o HSTS vale só para o próprio host.
function hstsSoDoHost(headers) {
  if (headers.has("strict-transport-security")) headers.set("strict-transport-security", "max-age=31536000");
  return headers;
}

// A casca da SPA, sempre inteira: pedido NOVO para "/", sem If-None-Match (um 304 aqui não teria
// corpo para reescrever — e o navegador ficaria com o <head> antigo depois de a linha mudar).
async function pegarCasca(context) {
  const raiz = new Request(new URL("/", context.request.url).toString(), { method: "GET" });
  const tentar = [];
  if (context.env?.ASSETS?.fetch) tentar.push(() => context.env.ASSETS.fetch(raiz));
  tentar.push(() => context.next(raiz));
  for (const pegar of tentar) {
    try {
      const res = await pegar();
      if (res && res.status === 200 && (res.headers.get("content-type") || "").includes("text/html")) {
        return { html: await res.text(), headers: res.headers };
      }
    } catch { /* tenta o próximo caminho */ }
  }
  return null;
}

// /api/ no domínio do cliente. As rotas públicas (lead, chat, visita) têm o portão sameOrigin(),
// que só conhece guileoai.com: sem isto, o formulário e o chat da página do cliente voltariam 403
// no domínio DELE. O host já foi conferido contra a linha ativa; quando o Origin/Referer do pedido
// é esse mesmo host, ele segue como o nosso. Origin de qualquer outro lugar segue como veio.
function comOrigemNossa(request, host, slug) {
  const raiz = semWww(host);
  const daqui = (u) => { try { return semWww(new URL(u).hostname.toLowerCase()) === raiz; } catch { return false; } };
  const origem = request.headers.get("Origin") || "";
  const ref = request.headers.get("Referer") || "";
  if (origem ? !daqui(origem) : !(ref && daqui(ref))) return null;
  const h = new Headers(request.headers);
  if (origem) h.set("Origin", NOSSO_SITE);
  if (ref && daqui(ref)) h.set("Referer", `${NOSSO_SITE}/novo/${slug}`);
  return new Request(request, { headers: h });
}

async function servirCliente(context, alvo) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const leitura = request.method === "GET" || request.method === "HEAD";
  if (!alvo.host) return liso(404, "Not found.");

  // Estático não consulta o banco. Reusa a regra de hoje (asset ausente = 404, nunca HTML) e
  // estende para a mídia: arquivo que não existe não pode devolver a casca da Guileo aqui.
  if (ehEstatico(path)) {
    const res = await legado(context);
    if ((res.headers.get("content-type") || "").includes("text/html")) return liso(404, "Not found.");
    if (alvo.prova || !res.headers.has("strict-transport-security")) return res;
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: hstsSoDoHost(new Headers(res.headers)) });
  }

  const d = await buscarDominio(context, alvo.host);
  if (d.estado === "erro") return fora();
  if (d.estado !== "ok") return liso(404, "This domain is not configured.");
  const linha = d.linha;

  // apex ↔ www: um site, um endereço. A forma gravada na linha é a canônica.
  if (alvo.host !== linha.host) {
    return new Response(null, {
      status: leitura ? 301 : 308,
      headers: { location: `https://${linha.host}${path}${url.search}`, "cache-control": "no-store" },
    });
  }

  // kind 'site' (/site/<slug>) ainda NÃO tem cabeça de servidor para domínio próprio, e vitrine
  // sem registro em VITRINES também não: melhor um 503 honesto do que um <head> genérico.
  if (linha.kind !== "vitrine" || !VITRINES[linha.slug]) {
    return liso(503, "This site is not ready on this domain yet.", { "retry-after": "3600" });
  }

  const rota = rotaDoCliente(path, linha.slug);
  if (rota.tipo === "api") {
    if (alvo.prova) return legado(context);
    const trocado = comOrigemNossa(request, linha.host, linha.slug);
    return trocado ? context.next(trocado) : context.next();
  }
  if (!leitura) return liso(405, "Method not allowed.", { allow: "GET, HEAD" });

  if (rota.tipo === "robots") {
    return new Response(robotsTxtDoCliente(linha), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": alvo.prova ? "no-store" : "public, max-age=300" },
    });
  }
  if (rota.tipo === "sitemap") {
    return new Response(sitemapDoCliente(linha), {
      headers: { "content-type": "application/xml; charset=utf-8", "cache-control": alvo.prova ? "no-store" : "public, max-age=300" },
    });
  }
  // endereço do site ANTIGO do cliente (WordPress) → o equivalente aqui, permanente (dominio.js · ANTIGOS)
  if (rota.tipo === "redirecionar") {
    return new Response(null, { status: 301, headers: { location: `https://${linha.host}${rota.para}`, "cache-control": "public, max-age=3600" } });
  }
  if (rota.tipo !== "pagina") {
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page not found</title><p>Page not found. <a href="/">Go to the home page</a></p>\n`, {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
    });
  }

  // "/astoria/" e "/Astoria" são a mesma página de "/astoria": um endereço só.
  const certo = rota.unidade ? `/${rota.unidade.caminho}` : "/";
  if (path !== certo) {
    return new Response(null, { status: 301, headers: { location: `https://${linha.host}${certo}${url.search}`, "cache-control": "no-store" } });
  }

  const cab = cabecaDoCliente({ slug: linha.slug, host: linha.host, indexable: linha.indexable, unidade: rota.unidade ? rota.unidade.id : null });
  const casca = await pegarCasca(context);
  const html = casca && cab ? reescreverCabeca(casca.html, cab, bootDoCliente(linha)) : null;
  if (!html) return fora();

  const headers = alvo.prova ? new Headers(casca.headers) : hstsSoDoHost(new Headers(casca.headers));
  ["content-length", "content-encoding", "etag", "last-modified"].forEach((n) => headers.delete(n));
  headers.set("content-type", "text/html; charset=utf-8");
  // Na prova o endereço é guileoai.com: esta resposta jamais pode ficar em cache nenhum.
  headers.set("cache-control", alvo.prova ? "no-store" : "public, max-age=0, must-revalidate");
  if (!linha.indexable) headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(request.method === "HEAD" ? null : html, { status: 200, headers });
}

export async function onRequest(context) {
  const alvo = alvoDoPedido(context);
  if (!alvo) return legado(context); // host NOSSO: o comportamento de sempre, e mais nada.
  try {
    return await servirCliente(context, alvo);
  } catch {
    return fora(); // domínio de cliente nunca cai no site da Guileo — nem por exceção.
  }
}


// Route → { title, description } — trilingual where the page is a funnel page (?lang=pt|es),
// plain strings elsewhere. Keep in sync with each page's useSeo().
const ROUTES = {
  "/pulse": {
    title: { en: "Guileo Pulse — know how your customers really feel, $49/mo", pt: "Guileo Pulse — saiba como seus clientes realmente se sentem, US$49/mês", es: "Guileo Pulse — sabe cómo se sienten tus clientes, US$49/mes" },
    description: { en: "Customer satisfaction measured from the calls you already get. CX score, 1-5 star ratings and surveys — every location included, no per-location bill.", pt: "Satisfação medida a partir das ligações que você já recebe. Nota de satisfação, avaliação de 1 a 5 estrelas e pesquisas — todas as unidades incluídas.", es: "Satisfacción medida desde las llamadas que ya recibes. Nota, calificación de 1 a 5 estrellas y encuestas — todas las sucursales incluidas." },
  },
  "/planos": {
    title: { en: "Guileo Plans — start your AI from $149/mo", pt: "Planos Guileo — ative sua IA a partir de $149/mês", es: "Planes Guileo — activa tu IA desde $149/mes" },
    description: { en: "Guileo self-service plans: Essential $149, Personalized $897, Full Operation $1,997/mo. AI that answers, books and sells 24/7. Live in minutes, 30-day money-back.", pt: "Planos de auto-serviço da Guileo: Essential $149, Personalized $897, Full Operation $1.997/mês. IA que atende, agenda e vende 24/7. No ar em minutos, 30 dias de garantia.", es: "Planes de autoservicio de Guileo: Essential $149, Personalized $897, Full Operation $1.997/mes. IA que atiende, agenda y vende 24/7. En marcha en minutos, 30 días de garantía." },
  },
  "/servicos": {
    title: { en: "Guileo Services — everything we build for your business", pt: "Serviços Guileo — tudo que construímos pro seu negócio", es: "Servicios Guileo — todo lo que construimos para tu negocio" },
    description: { en: "AI voice agents, websites, apps, marketing and automation — one team that builds and operates it all for local businesses.", pt: "Agentes de voz com IA, sites, apps, marketing e automação — um time que constrói e opera tudo pra negócios locais.", es: "Agentes de voz con IA, webs, apps, marketing y automatización — un equipo que lo construye y opera todo para negocios locales." },
  },
  "/calculator": {
    title: "Missed-Call Loss Calculator — what silence costs your business | Guileo",
    description: "Estimate how much revenue missed calls cost your business every month — and what an AI receptionist recovers.",
  },
  "/lead-generation": {
    title: "Lead Generation with AI — speed-to-lead in 60 seconds | Guileo",
    description: "Guileo calls every new lead back in about 60 seconds, qualifies them and books the appointment — before your competitor answers.",
  },
  "/home-services": {
    title: "AI Receptionist for Home Services — plumbing, HVAC, electrical | Guileo",
    description: "Emergency calls answered 24/7, jobs quoted and dispatched. Guileo catches the calls your crew can't while on the job.",
  },
  "/marketing": {
    title: "Guileo Marketing — ads, content and growth for local businesses",
    description: "Performance marketing operated by AI + humans: ads, landing pages, follow-up and booking — priced to results.",
  },
  "/academia": {
    title: { en: "Guileo Academy — learn to grow with AI", pt: "Academia Guileo — aprenda a crescer com IA", es: "Academia Guileo — aprende a crecer con IA" },
    description: { en: "Free lessons on using AI to answer, book and sell for your local business.", pt: "Aulas gratuitas sobre usar IA pra atender, agendar e vender no seu negócio.", es: "Lecciones gratis sobre usar IA para atender, agendar y vender en tu negocio." },
  },
  "/vendedor": {
    title: { en: "Guileo Seller Hub — pitch, quote and close", pt: "Hub do Vendedor Guileo — pitch, orçamento e fechamento", es: "Hub del Vendedor Guileo — pitch, cotización y cierre" },
    description: { en: "The Guileo seller workspace: pitch cards, AI practice, quote generator and activation guide.", pt: "O espaço do vendedor Guileo: pitch cards, treino com IA, gerador de orçamento e guia de ativação.", es: "El espacio del vendedor Guileo: pitch cards, práctica con IA, cotizador y guía de activación." },
  },
  "/receber": {
    title: { en: "Get paid — connect your Stripe | Guileo", pt: "Receber pagamentos — conecte seu Stripe | Guileo", es: "Cobrar pagos — conecta tu Stripe | Guileo" },
    description: { en: "Connect your Stripe so Gui charges on the call and the money lands in YOUR account.", pt: "Conecte seu Stripe pra Gui cobrar na ligação e o dinheiro cair na SUA conta.", es: "Conecta tu Stripe para que Gui cobre en la llamada y el dinero caiga en TU cuenta." },
  },
  "/go-live": {
    title: { en: "Go live — activate your Guileo AI step by step", pt: "Entrar no ar — ative sua IA Guileo passo a passo", es: "Salir en vivo — activa tu IA Guileo paso a paso" },
    description: { en: "The activation checklist: pay, connect your cockpit, forward your line, load your menu and go live.", pt: "O checklist de ativação: pague, conecte o cockpit, redirecione sua linha, carregue seu cardápio e entre no ar.", es: "La lista de activación: paga, conecta el cockpit, desvía tu línea, carga tu menú y sal en vivo." },
  },
  "/prospects": {
    title: "Prospecting with Guileo — find and win local clients",
    description: "Tools and playbooks for finding, pitching and closing local businesses with Guileo.",
  },
  "/consulting": {
    title: { en: "Guileo Consulting — done-for-you AI, tailored to your business", pt: "Consultoria Guileo — IA feita pra você, sob medida", es: "Consultoría Guileo — IA hecha para ti, a medida" },
    description: { en: "A dedicated build: your own number, custom training, integrations and a team that operates it. Quoted per business.", pt: "Projeto dedicado: número próprio, treino sob medida, integrações e um time que opera. Cotado por negócio.", es: "Proyecto dedicado: número propio, entrenamiento a medida, integraciones y un equipo que lo opera. Cotizado por negocio." },
  },
  "/quiz": {
    title: "Business Growth Quiz — where is your revenue leaking? | Guileo",
    description: "60-second quiz: find where your business loses revenue and what AI can recover.",
  },
  "/grader": {
    title: "Website Grader — how well does your site sell? | Guileo",
    description: "Free instant grade of your website's speed, SEO and conversion readiness.",
  },
  "/partners": {
    title: "Guileo Partners — grow with us",
    description: "Partner with Guileo: referrals, white-label and agency programs for AI receptionists.",
  },
  "/nossa-gente": {
    title: { en: "Our People — the humans behind Guileo", pt: "Nossa Gente — os humanos por trás da Guileo", es: "Nuestra Gente — los humanos detrás de Guileo" },
    description: { en: "Guileo is AI supervised by real people. Meet the team.", pt: "A Guileo é IA supervisionada por gente de verdade. Conheça o time.", es: "Guileo es IA supervisada por personas reales. Conoce al equipo." },
  },
  "/blog": {
    title: "Guileo Blog — AI, growth and local business",
    description: "Practical guides on AI receptionists, missed calls, bookings and growing a local business.",
  },
  "/live": {
    title: "Live Demo — Gui calls you in seconds | Guileo",
    description: "Enter your name and phone — Guileo's AI calls you and shows what it does for your business, live.",
  },
  "/privacy": { title: "Privacy Policy | Guileo", description: "How Guileo (ORIGEM LTDA) collects, uses and protects your data." },
  "/terms": { title: "Terms of Service | Guileo", description: "The terms that govern your use of Guileo's products and services." },
  "/refunds": { title: "Refund & Cancellation Policy | Guileo", description: "Guileo's refund, cancellation and 30-day money-back terms for plans, credit top-ups and setup fees." },
  "/cancellation": { title: "Refund & Cancellation Policy | Guileo", description: "How to cancel your Guileo plan and when you can get money back — 30-day guarantee." },
  "/contact": { title: "Contact | Guileo", description: "Reach Guileo (ORIGEM LTDA) — sales, client support, and LGPD/GDPR/CCPA privacy requests." },
  "/cookies": { title: "Cookie & Privacy Policy | Guileo", description: "How Guileo uses cookies and handles your data — LGPD, GDPR and CCPA aligned." },
  "/compliance": { title: "Compliance | Guileo", description: "Guileo's approach to TCPA, HIPAA-aligned handling, GDPR and responsible AI." },
};

// ── O SITE DA GUILEO, COMO SEMPRE FOI ────────────────────────────────────────────────────────
// Corpo intocado do onRequest anterior. Só mudou o nome: o onRequest (no topo) chama esta função
// direto, sem mais nada, quando o host é nosso.
export async function legado(context) {
  const { request } = context;
  // HEAD também: `curl -I` num asset ausente devolvia 200 com HTML e podia semear o cache —
  // a sonda que eu usei pra "provar" a correção estava furando a própria correção.
  if (request.method !== "GET" && request.method !== "HEAD") return context.next();
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  // Every valid first path segment (static routes + dynamic prefixes in src/App.jsx). Keep in sync
  // when a route is added. Generous by design — a missing entry only softens a real 404, never blocks
  // a valid page (which would be far worse).
  const KNOWN_SEGMENTS = new Set([
    "agendar", "f", "minha-reserva", "minha-conta", "academia", "admin", "agente", "classica", "ai-receptionist", "blog", "nova", "calculator", "cola", "colaborador", "compliance",
    "conectar-stripe", "consulting", "consultoria", "contact", "cookies", "cancellation", "deck", "demo",
    "for", "get-paid", "go-live", "grader", "health-compliance", "hipaa", "home-services", "kit",
    "lead-generation", "leads", "live", "lp", "marketing", "sms", "nossa-gente", "parceiro", "partners", "pitch",
    "planos", "plans", "desk", "balcao", "projeto",
    // 🚨 ROTA NOVA SEM ESTE NOME = 404 REAL EM PRODUÇÃO (o teste `rotas.test.mjs` pegou as duas).
    // A página existe no App.jsx e abre no navegador em desenvolvimento; em produção o middleware
    // devolve 404 porque o primeiro segmento não está nesta lista. É a armadilha que já mordeu
    // este repositório antes — por isso o teste existe, e por isso ele roda antes de todo deploy.
    "menu", "novo",
    // /pulse — página do produto de $49. A 4ª vez que uma rota nova quase nasceu 404: o teste
    // functions/lib/rotas.test.mjs compara App.jsx com esta lista, então ele pegaria — mas entrar
    // aqui no MESMO commit é o que faz o teste nunca precisar falhar.
    "pulse", "portal", "precos", "privacy", "proposta", "prospeccao", "prospects", "quiz",
    "receber", "refunds", "roteiro", "seller", "servicos", "setup-agenda", "sign", "terms", "v2", "vendedor",
    // Rótulos do menu que viraram URL: "Setores"/"Demonstração" (e os equivalentes EN/ES) existiam
    // só como âncora, então a URL óbvia — a que sai num print ou num anúncio — dava 404. Cada um
    // redireciona para a âncora real (/#industries e /#try) em public/_redirects + App.jsx.
    "setores", "industries", "sectores", "demonstracao", "demostracion",
    // hubs internos da equipe (suporte técnico + marketing/performance) — rotas reais, não indexáveis
    "equipe", "tecnico", "marketing-hub",
    // site REAL do cliente (produto foundation) — /site/:slug
    "site", "primeira-semana",
    // /voz/:slug — a Gui atendendo por VOZ no navegador (2026-08-11). Sem operadora, sem A2P,
    // sem saldo de telefonia: é o servidor e o microfone do visitante.
    "voz",
    // VITRINE (/vitrine/:token) — a demo que o vendedor compartilha com o cliente. Ficou de
    // fora da lista até 2026-08-05 e o middleware devolvia 404 REAL: o vendedor mandava o
    // link, o cliente abria e via "página não encontrada". A demo funcionava; a porta é que
    // estava trancada. Rota nova no App.jsx SEMPRE precisa entrar aqui — este é o segundo
    // caso, então virou verificação: comparar os path="/x" do App com esta lista.
    "vitrine",
    // /heroi — página de decisão do herói (duas direções com a logo 3D real). TERCEIRO caso
    // do mesmo esquecimento: rota criada no App.jsx, ausente aqui, 404 real. A verificação
    // deixou de ser "lembrar" e virou teste: functions/lib/rotas.test.mjs compara os
    // path="/x" do App.jsx com esta lista e falha se alguma sobrar de fora.
    "heroi",
    // /orcamento/:token — o ORÇAMENTO que o vendedor manda pro cliente aceitar (2026-08-25).
    // QUARTO caso do mesmo esquecimento — e desta vez a sonda rotas.test.mjs pegou ANTES de ir
    // pro ar: sem esta linha, o vendedor manda o link no momento mais quente do funil e o
    // cliente abre um 404 real. A rota é pública de propósito: o token É a credencial.
    "orcamento",
    // /apresentacao/:id — o Growth Report/quote que o dono do negócio abre (motor de avaliação).
    // QUINTO caso da rota-que-nasce-404. A lista continua sendo a porta; o teste rotas.test.mjs
    // compara com o App.jsx — se você está lendo isto porque deu 404, a rota ficou de fora DAQUI.
    "apresentacao",
    // /raio-x (+ /x-ray, /xray) — o PEDIDO PÚBLICO do Guileo X-Ray: destino de anúncio onde o dono
    // do negócio pede o relatório dele. Rota pública e paga em tráfego: um 404 aqui queima anúncio.
    "raio-x", "x-ray", "xray",
    // link curto por cliente (/natura → o Growth Report dela). O middleware roda ANTES do
    // _redirects estático: sem entrar aqui, o soft-404 mata o atalho antes de ele existir.
    "natura",
    // versão em PORTUGUÊS do mesmo Growth Report (payload próprio, escrito pelo motor em pt —
    // não é a mesma página traduzida na moldura: as evidências e premissas nascem em pt).
    "natura-pt",
    "natura-setup", // checklist da implantação que a Natura preenche (2026-10-18)
    // /natura-channels (+ /natura-channels/dashboard) — login e painel do módulo de canais
    // (e-mail/WhatsApp/voz/SMS/FB/IG) da Natura. Pego pelo rotas.test.mjs antes do deploy.
    "natura-channels",
    // SEXTO caso da rota-que-nasce-404 (24/08). /presente/<negocio> são páginas ESTÁTICAS de
    // prospecção — um HTML por prospect, servido de public/, fora do SPA. O link vai dentro de um
    // e-mail para o dono de um negócio real: um 404 aqui não custa tráfego, custa a única chance
    // de primeira impressão que existe. Estático em public/ NÃO basta — este middleware roda antes.
    "presente",
    // Apresentação da Guileo para a dona da Natura (2026-10-01), em português e em inglês. Páginas
    // ESTÁTICAS em public/, fora do SPA, com noindex — o link vai direto para a cliente.
    "natura-apresentacao", "natura-presentation",
  ]);
  // /sign?t=… — prévia do link de assinatura (iMessage/WhatsApp): o <head> certo no HTML cru.
  // Natura → capa da parceria; resto → cartão neutro. Ver functions/lib/signOg.js.
  if (path === "/sign" && request.method === "GET") return signOg(context);
  // /projeto?t=… — prévia do link do acompanhamento de projeto (functions/lib/projetoOg.js).
  if (path === "/projeto" && request.method === "GET") return projetoOg(context);
  // /natura-setup — prévia do link com a capa Natura × Guileo (checklist da implantação).
  if (path === "/natura-setup" && request.method === "GET") return cartaoFixoOg(context, CARTAO_NATURA_SETUP, "https://guileoai.com/natura-setup");
  const meta = ROUTES[path];
  if (meta) {
    const lang = langFromUrl(request.url);
    return rewriteOg(context, {
      title: pick(meta.title, lang),
      description: pick(meta.description, lang),
      url: SITE + url.pathname,
    });
  }
  // ── SOFT-404 FIX ──────────────────────────────────────────────────────────────
  // The SPA shell answers 200 on EVERY path, so a nonexistent URL is a "soft 404" that
  // wastes crawl budget and can get indexed. Below we return a real HTTP 404 (still
  // serving the shell so React renders the NotFound page) for any path whose first
  // segment isn't a known route. The allowlist is GENEROUS — every real static route +
  // every dynamic prefix — so a valid page can never be wrongly 404'd. Assets, /api,
  // /.well-known and anything with a file extension pass straight through.
  const first = path.split("/")[1] || "";
  // ⚠️ A RÉGUA DA EXTENSÃO ERA CURTA DEMAIS (corrigido 2026-08-20).
  // Era `/\.[a-z0-9]{2,5}$/` — de 2 a 5 letras, escrita quando .html/.json/.png eram o mundo
  // inteiro. `manifest.WEBMANIFEST` tem 11, não coube, caiu na rota desconhecida e voltou 404
  // servindo o conteúdo CERTO com o status ERRADO — e navegador não instala PWA em cima de 404.
  // Agora até 12, e os arquivos de raiz do app entram por nome, que é à prova de régua.
  const RAIZ = new Set(["manifest.webmanifest", "sw.js", "robots.txt", "sitemap.xml", "favicon.ico",
    // /index.html existe de verdade (o Pages responde 308 -> /). Sem estar aqui, a regra do
    // .html abaixo o trataria como página desconhecida e devolveria 404 em cima do redirect.
    "index.html"]);
  // ⚠️ .html NÃO É ASSET — É PÁGINA (corrigido 2026-08-27).
  // A régua da extensão dava passe livre a QUALQUER coisa terminada em ponto+extensão, e
  // `.html` cabia nela. Resultado: `/lorem-ipsum-123.html` — uma URL que nunca existiu —
  // voltava 200 servindo a HOME INTEIRA. Soft-404 infinito: incontáveis endereços com o
  // mesmo conteúdo e status de sucesso, diluindo o sinal das páginas reais de vertical×cidade.
  // Só apareceu quando concept.html/experience.html foram apagados e caíram neste balde.
  // Página tem que passar pela checagem de rota conhecida; asset de verdade continua passando.
  // Os .html legítimos ficam cobertos: /index.html entra por nome no RAIZ acima, e
  // /presente/<negocio>/index.html entra porque "presente" está em KNOWN_SEGMENTS.
  const isPaginaHtml = /\.html?$/i.test(path);
  // "@..." (first char of the first segment) is Vite's reserved dev-server namespace
  // (/@vite/client, /@react-refresh, /@fs/…) — never a real route, only present when
  // `wrangler pages dev` proxies to Vite locally. Production never serves these paths,
  // so excluding them here has no effect in prod and avoids 404ing Vite's HMR client
  // (which breaks React's refresh preamble and shows as a blank page / error overlay).
  const isAssetish = first === "" || first === "api" || first === "assets" || first === ".well-known"
    || first.startsWith("@") || RAIZ.has(first) || (!isPaginaHtml && /\.[a-z0-9]{2,12}$/i.test(path));
  // 🚨 ARQUIVO QUE NÃO EXISTE EM /assets NUNCA PODE VOLTAR 200 COM HTML (2026-08-20).
  // Foi assim que o HUB DO VENDEDOR ficou com a tela preta em produção: pedi um
  // /assets/<chunk>.js ANTES do deploy propagar, o Pages respondeu com o index.html da SPA
  // (200, text/html), e `public/_headers` marca /assets/* como `immutable` — o Cloudflare
  // congelou aquele HTML naquele endereço. Todo navegador que pediu o módulo depois recebeu
  // HTML, o import quebrou e o React não montou. Uma consulta feita cedo demais destruiu o
  // endereço por um ano.
  // 404 + no-store fecha a porta na origem: não existe mais resposta cacheável para um asset
  // ausente, então nem uma consulta antecipada nem um pedido durante a propagação envenenam nada.
  if (first === "assets") {
    const res = await context.next();
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      return new Response("asset not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return res;
  }

  if (!isAssetish && !KNOWN_SEGMENTS.has(first)) {
    const res = await context.next();
    // Serve the exact same shell body/headers, but with a 404 status for crawlers.
    return new Response(res.body, { status: 404, statusText: "Not Found", headers: res.headers });
  }
  return context.next();
}
