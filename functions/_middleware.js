// Pages middleware — per-route SEO meta in the RAW HTML (social crawlers don't run JS).
// The SPA sets titles client-side via useSeo(), but WhatsApp/Facebook/Google-first-pass read the
// static shell, which carries the HOMEPAGE title + canonical on every route. This mirrors each
// page's useSeo() values server-side via the same battle-tested rewriteOg() text pass used by
// /for/* and /blog/*. Those two route families have their own functions — they are NOT in this
// map, so nothing is processed twice. /api/* and non-HTML pass through untouched.
import { rewriteOg, langFromUrl, pick, SITE } from "./lib/ogMeta.js";

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

export async function onRequest(context) {
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
    "academia", "admin", "agente", "ai-receptionist", "blog", "calculator", "cola", "colaborador", "compliance",
    "conectar-stripe", "consulting", "consultoria", "contact", "cookies", "cancellation", "deck", "demo",
    "for", "get-paid", "go-live", "grader", "health-compliance", "hipaa", "home-services", "kit",
    "lead-generation", "leads", "live", "lp", "marketing", "sms", "nossa-gente", "parceiro", "partners", "pitch",
    "planos", "plans",
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
  ]);
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
  const RAIZ = new Set(["manifest.webmanifest", "sw.js", "robots.txt", "sitemap.xml", "favicon.ico"]);
  const isAssetish = first === "" || first === "api" || first === "assets" || first === ".well-known"
    || RAIZ.has(first) || /\.[a-z0-9]{2,12}$/i.test(path);
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
