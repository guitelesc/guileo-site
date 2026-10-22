// DOMÍNIO PRÓPRIO DO CLIENTE — as decisões PURAS (nada de rede, nada de banco, nada de DOM).
//
// Quem usa:
//   · functions/_middleware.js — decide se o Host é nosso ou de cliente, qual caminho serve o quê,
//     e reescreve o <head> da casca no servidor;
//   · src/novo/NaturaSpa.jsx   — usa as MESMAS funções de título/canonical/JSON-LD, para o que o
//     React escreve depois de montar ser idêntico ao que o servidor já mandou no HTML cru.
//
// REGRA Nº 1: um host que é NOSSO (guileoai.com, *.pages.dev, localhost) nunca é tratado como
// domínio de cliente. REGRA Nº 2: num domínio de cliente só existem a página dele, os arquivos
// estáticos, /api/, robots.txt e sitemap.xml. /portal, /admin, /sales, /novo/<outro> → 404.
//
// Teste: node functions/lib/dominio.test.mjs
import { FLOR } from "../../src/novo/naturaArco.js";

export const NOSSO_SITE = "https://guileoai.com";

// ── HOSTS ────────────────────────────────────────────────────────────────────────────────────

const limpar = (bruto) => String(bruto == null ? "" : bruto).trim().toLowerCase().replace(/\.$/, "");

/** Host de verdade → a forma minúscula, sem ponto final. Qualquer outra coisa → null.
    Recusa esquema, caminho, porta, espaço, IP e nome de um rótulo só ("localhost"). */
export function normalizarHost(bruto) {
  const h = limpar(bruto);
  if (!h || h.length > 253) return null;
  if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(h)) return null;
  return h;
}

/** A mesma raiz para "www.x.com" e "x.com" — é a chave de busca e de cache. */
export const semWww = (h) => String(h || "").replace(/^www\./, "");

const NOSSOS = ["guileoai.com", "localhost", "127.0.0.1", "[::1]", "::1"];

/** O host é da Guileo (ou de desenvolvimento)? Então NADA deste arquivo se aplica a ele.
    `extras` = hosts adicionais nossos (env GUILEO_HOSTS), para um apelido futuro do projeto. */
export function ehNosso(bruto, extras = []) {
  let h = limpar(bruto);
  if (!h) return false;
  if (!h.startsWith("[")) h = h.replace(/:\d+$/, ""); else h = h.replace(/\]:\d+$/, "]");
  h = semWww(h);
  if (NOSSOS.includes(h)) return true;
  if (h.endsWith(".guileoai.com")) return true;
  if (h === "pages.dev" || h.endsWith(".pages.dev")) return true;
  if (h.endsWith(".localhost")) return true;
  return (Array.isArray(extras) ? extras : []).some((e) => semWww(limpar(e)) === h);
}

/** Host de CLIENTE pronto para consulta, ou null (host nosso, ou malformado). */
export function hostDeCliente(bruto, extras = []) {
  if (ehNosso(bruto, extras)) return null;
  return normalizarHost(bruto);
}

// ── AS VITRINES QUE PODEM IR PARA DOMÍNIO PRÓPRIO ────────────────────────────────────────────
// O <head> sai do SERVIDOR, e o servidor não executa o React. Então os FATOS que entram no head e
// no JSON-LD de cada vitrine moram aqui. Eles repetem o que a página mostra — e o teste
// (dominio.test.mjs) confere cada valor contra o texto de src/novo/<Pagina>.jsx: se alguém mudar o
// telefone na página e esquecer daqui, o teste fica vermelho. Nada aqui é inventado.
// `caminho` de cada unidade = o nome curto dela na página, em minúsculas com hífen.
export const VITRINES = {
  "natura-spa": {
    fonte: "src/novo/NaturaSpa.jsx",
    nome: "Natura Spa + Salon",
    titulo: "Brazilian Hair Salon & Spa Astoria and UES, NY | Natura Spa",
    descricao: "Brazilian Hair Salon & Spa in Astoria and UES, NY offering balayage, hair styling, facials, & massages. Book your Massage and Hair appointment now!",
    email: "naturaspanyc@gmail.com",
    arquivos: "/novo/natura-spa/v3",
    capa: "hero-poster.jpg",
    idioma: "en_US",
    faixaDePreco: "$$",
    regiao: "NY",
    pais: "US",
    // A flor de 5 pétalas do logo deles, no rosa que o site deles usa (medido no pixel).
    icone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 31"><path fill="#C37B89" fill-rule="evenodd" d="${FLOR}"/></svg>`,
    redes: [
      "https://www.instagram.com/naturaspanyc/",
      "https://www.facebook.com/naturaspanyc",
      "https://www.yelp.com/biz/natura-spa-astoria-4",
    ],
    unidades: [
      {
        id: "astoria", caminho: "astoria", curto: "Astoria", tipo: ["DaySpa", "HairSalon"],
        marca: "Natura Spa + Salon · Astoria",
        texto: "Nestled in the heart of Astoria, our salon and med spa offers a full body-mind-soul escape tailored just for you. Passionate hands, pure products, and a warm space will have you stepping back into the city feeling naturally radiant.",
        rua: "30-79 Steinway Street", cidade: "Astoria, NY 11103", tel: "+17189565530",
        semana: [10, 20], dom: [11, 19], geo: [40.76184, -73.91673], foto: "astoria-1",
        reservar: "https://clients.mindbodyonline.com/consumerbooking?studioid=767008",
      },
      {
        id: "ues", caminho: "upper-east-side", curto: "Upper East Side", tipo: ["DaySpa", "HairSalon"],
        marca: "Natura Spa + Salon · Upper East Side",
        texto: "Perched on Lexington Avenue, this sanctuary invites you to unwind and recharge. Our dedicated experts deliver therapies infused with positive energy—and you’ll leave carrying that calm, natural beauty wherever you go.",
        rua: "842 Lexington Ave", cidade: "New York, NY 10065", tel: "+12122580661",
        semana: [9, 19], dom: [10, 18], geo: [40.76534, -73.96611], foto: "ues-1",
        reservar: "https://clients.mindbodyonline.com/consumerbooking?studioid=5734109",
      },
      {
        id: "med", caminho: "med-spa-ues", curto: "Med Spa UES", tipo: "HealthAndBeautyBusiness",
        marca: "Natura Med Spa · Upper East Side",
        texto: "Tucked away on 63rd St and 3rd Ave, our UES retreat blends urban luxury with holistic care. From soothing facials to revitalizing massages, each personalized treatment uses clean, potent ingredients to refresh your glow inside and out.",
        rua: "166 East 63rd Street", cidade: "New York, NY 10065", tel: "+12122580661",
        semana: [10, 19], dom: [10, 17], geo: [40.76411, -73.96557], foto: "med-1",
        reservar: "https://clients.mindbodyonline.com/consumerbooking?studioid=5734109",
      },
    ],
    faq: [
      ["What is the cancellation policy?", "When you book an appointment at Natura Spa, we reserve the time and space especially for you. Please notify us at least 24 hours in advance to cancel or reschedule. With less than 24 hours’ notice the fee is 50% of the booked services. No shows and same day cancellations are charged 100% of the booked services."],
      ["How do gift cards work?", "Gift cards are non-refundable and cannot be exchanged for cash or laser and nail services. They are valid only at the location selected at the time of purchase and cannot be transferred between the Manhattan and Astoria locations. They are valid for one year from the date of purchase."],
      ["Are prices the same at every location?", "No. Astoria and the Upper East Side have their own menus and prices. Pick your location at the top of the menu and every price on this page follows."],
      ["Is the price on the menu final?", "Services may vary based on length of hair and amount of time. Prices are subject to change for exceptional cases, and a consultation is required for the final price. No refunds."],
      ["How much does CoolSculpting® Elite cost?", "Pricing varies based on several factors. You receive a customized quote after your initial consultation, which is free."],
    ],
  },
};

// ── ENDEREÇOS DO SITE ANTIGO (WordPress) → SITE NOVO ─────────────────────────────────────────
// No dia em que o domínio do cliente aponta para cá, cada endereço que o Google já conhece tem que
// responder 301 para o lugar equivalente — senão vira 404 e a posição na busca daquela página se perde.
// A lista sai do sitemap DELES (naturaspanyc.com/page-sitemap1.xml + post-sitemap1.xml, lido em
// 2026-10-04: 15 endereços). A home não entra: "/" continua "/". Destino com "#" abre a seção certa
// (o Google ignora o "#" e consolida na página; quem clica no link antigo cai na seção).
export const ANTIGOS = {
  "natura-spa": {
    "about": "/#about",
    "lilian": "/#lilian",
    "wendy": "/#about",
    "coolsculpting-elite-nyc": "/med-spa-ues#medspa",
    "gift-cards": "/#gift",
    "hair-salon-astoria": "/astoria",
    "hair-salon-east-side": "/upper-east-side",
    "locations": "/#locations",
    "med-spa-astoria": "/astoria#medspa",
    "med-spa-east-side": "/med-spa-ues",
    "reviews": "/#reviews",
    "services-menu-astoria": "/astoria#menu",
    "services-menu-east-side": "/upper-east-side#menu",
    "specials": "/#specials",
    // links do rodapé deles (não estão no sitemap, mas estão em toda página do site antigo)
    "privacy-policy": "/#privacy",
    "cancellation-policy": "/#cancellation",
  },
};

/** Endereço antigo ("/about/", "/About") → destino novo, ou null. */
export function redirecionamentoDe(slug, pathname) {
  const mapa = Object.prototype.hasOwnProperty.call(ANTIGOS, slug) ? ANTIGOS[slug] : null;
  const p = String(pathname || "").replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!mapa || !p || p.includes("/") || !Object.prototype.hasOwnProperty.call(mapa, p)) return null;
  return mapa[p];
}

/** "Upper East Side" → "upper-east-side". É assim que o caminho de uma unidade nasce do nome dela. */
export const caminhoDe = (nome) => String(nome || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Unidade de uma vitrine pelo caminho da URL ("/astoria", "/astoria/"), ou null. */
export function unidadeDoCaminho(slug, pathname) {
  const v = VITRINES[slug];
  const p = String(pathname || "").replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!v || !p || p.includes("/")) return null;
  return v.unidades.find((u) => u.caminho === p) || null;
}

// ── O QUE CADA CAMINHO FAZ NUM DOMÍNIO DE CLIENTE ────────────────────────────────────────────
const MIDIA = /\.(png|jpe?g|webp|avif|gif|svg|ico|mp4|webm|woff2?|ttf|otf)$/i;

/** Estático que passa direto, sem consultar o banco: os pedaços do app e a mídia das vitrines.
    Página (.html) e rota limpa NUNCA são estático. */
export function ehEstatico(pathname) {
  const p = String(pathname || "");
  if (p.includes("..") || /\.html?$/i.test(p)) return false;
  if (/^\/assets\/[^/].*/.test(p)) return true;
  return /^\/novo\/[a-z0-9-]+\/.+/i.test(p) && MIDIA.test(p);
}

/**
 * Caminho pedido num domínio de cliente → o que servir.
 *   { tipo: "estatico" }            arquivo do app / mídia — segue para o Pages
 *   { tipo: "api" }                 /api/* — segue para a função
 *   { tipo: "robots" | "sitemap" }  gerados para ESTE host
 *   { tipo: "pagina", unidade }     a página do cliente (unidade = null na raiz)
 *   { tipo: "redirecionar", para }  endereço do site antigo → 301 para o equivalente (ANTIGOS)
 *   { tipo: "negado" }              qualquer outra rota da Guileo → 404
 */
export function rotaDoCliente(pathname, slug) {
  const p = String(pathname || "/");
  if (ehEstatico(p)) return { tipo: "estatico" };
  if (p.startsWith("/api/")) return { tipo: "api" };
  if (p === "/robots.txt") return { tipo: "robots" };
  if (p === "/sitemap.xml") return { tipo: "sitemap" };
  if (p === "/" || p === "") return { tipo: "pagina", unidade: null };
  const u = unidadeDoCaminho(slug, p);
  if (u) return { tipo: "pagina", unidade: u };
  const para = redirecionamentoDe(slug, p);
  if (para) return { tipo: "redirecionar", para };
  return { tipo: "negado" };
}

// ── CABEÇA DA PÁGINA ─────────────────────────────────────────────────────────────────────────
const ROBOTS_SIM = "index, follow, max-image-preview:large, max-snippet:-1";
const ROBOTS_NAO = "noindex, nofollow";
export const robotsDe = (indexable) => (indexable === true ? ROBOTS_SIM : ROBOTS_NAO);

const doisDigitos = (n) => String(n).padStart(2, "0");

/**
 * JSON-LD da vitrine.
 *   { origem: "https://www.cliente.com" }  → no domínio do cliente: cada unidade tem a URL da SUA
 *                                            página e @id estável na raiz do domínio;
 *   { previa: true }                       → na prévia em guileoai.com/novo/<slug>: exatamente o
 *                                            grafo que a página já publicava (tudo aponta para a prévia).
 *   unidade (id) → só aquela unidade (página de unidade); sem unidade → todas + FAQPage.
 */
export function ldVitrine(slug, { origem = "", previa = false, unidade = null } = {}) {
  const v = VITRINES[slug];
  if (!v) return null;
  const pagina = `${NOSSO_SITE}/novo/${slug}`;
  const base = previa ? NOSSO_SITE : origem;
  const urlDe = (u) => (previa ? pagina : `${origem}/${u.caminho}`);
  const idDe = (u) => (previa ? `${pagina}#${u.id}` : `${origem}/#${u.id}`);
  const horario = (u) => [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: `${doisDigitos(u.semana[0])}:00`, closes: `${u.semana[1]}:00` },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: `${doisDigitos(u.dom[0])}:00`, closes: `${u.dom[1]}:00` },
  ];
  const casa = (u) => ({
    "@type": u.tipo, "@id": idDe(u), name: u.marca, url: urlDe(u), telephone: u.tel, email: v.email,
    image: `${base}${v.arquivos}/${u.foto}.webp`, priceRange: v.faixaDePreco,
    address: { "@type": "PostalAddress", streetAddress: u.rua, addressLocality: u.cidade.split(",")[0], addressRegion: v.regiao, postalCode: u.cidade.slice(-5), addressCountry: v.pais },
    geo: { "@type": "GeoCoordinates", latitude: u.geo[0], longitude: u.geo[1] },
    openingHoursSpecification: horario(u), sameAs: v.redes,
    potentialAction: { "@type": "ReserveAction", target: u.reservar },
  });
  const so = unidade ? v.unidades.find((u) => u.id === unidade) : null;
  if (unidade && !so) return null;
  const grafo = so
    ? [casa(so)]
    : [...v.unidades.map(casa),
      { "@type": "FAQPage", mainEntity: v.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }];
  return { "@context": "https://schema.org", "@graph": grafo };
}

/**
 * Tudo que o <head> de uma página de cliente precisa, NO DOMÍNIO DELE.
 * Entrada: slug da vitrine, host canônico (o da linha do banco), indexable, e a unidade (id) quando
 * a página é de uma unidade. Saída: null se a vitrine não tem cabeça registrada aqui.
 * Título/descrição da unidade = o nome e o texto que ELES publicam daquela unidade + o endereço.
 */
export function cabecaDoCliente({ slug, host, indexable = false, unidade = null }) {
  const v = VITRINES[slug];
  const h = normalizarHost(host);
  if (!v || !h) return null;
  const origem = `https://${h}`;
  const u = unidade ? v.unidades.find((x) => x.id === unidade) : null;
  if (unidade && !u) return null;
  return {
    origem,
    nome: v.nome,
    titulo: u ? `${u.marca} | ${u.rua}, ${u.cidade}` : v.titulo,
    descricao: u ? u.texto : v.descricao,
    canonical: u ? `${origem}/${u.caminho}` : `${origem}/`,
    imagem: `${origem}${v.arquivos}/${u ? `${u.foto}.webp` : v.capa}`,
    robots: robotsDe(indexable),
    idioma: v.idioma,
    icone: v.icone ? `data:image/svg+xml,${encodeURIComponent(v.icone)}` : "",
    ld: ldVitrine(slug, { origem, unidade: u ? u.id : null }),
  };
}

// ── REESCRITA DO <head> DA CASCA ─────────────────────────────────────────────────────────────
// Passe de TEXTO, como o rewriteOg() da casa (functions/lib/ogMeta.js) — e não HTMLRewriter — por
// dois motivos: (1) é a forma que já roda em produção sem os 1101 de streaming/Content-Encoding;
// (2) roda em Node, então o teste exercita a reescrita contra o dist/index.html DE VERDADE.
const atr = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
/** JSON dentro de <script>: "<" nunca aparece cru, então nada fecha a tag por dentro. */
const SEP_LINHA = new RegExp("[" + String.fromCharCode(0x2028, 0x2029) + "]", "g");
export const jsonSeguro = (o) => JSON.stringify(o).replace(/</g, "\\u003c")
  .replace(SEP_LINHA, (c) => "\\u" + c.charCodeAt(0).toString(16));

/**
 * Troca a identidade da GUILEO no <head> da casca pela do cliente.
 * Sai: title, description, robots, canonical, ícone, Open Graph, Twitter, JSON-LD do cliente e o
 * bloco de dados `#tenant-boot` (o React lê e sobe a página do cliente na "/").
 * Some: title/description/author/keywords/robots/theme-color da Guileo, OG/Twitter, canonical,
 * hreflang, ícones, manifesto, metas de app, TODO JSON-LD da casca e os comentários internos.
 * Fica: charset, viewport, CSP, preconnect, e os <script>/<link> do app (senão a página não sobe).
 * Devolve null se o HTML não tem <head> — quem chama responde 503, nunca a casca crua.
 *
 * `boot` vai como DADO (type="application/json"), não como script inline: a CSP do site não tem
 * 'unsafe-inline', então `<script>window.x = …</script>` seria BLOQUEADO calado em produção.
 */
export function reescreverCabeca(html, cab, boot) {
  const src = String(html || "");
  const ini = src.search(/<head[^>]*>/i);
  const fim = src.search(/<\/head>/i);
  if (!cab || ini < 0 || fim < ini) return null;
  const abre = src.slice(ini).match(/<head[^>]*>/i)[0];
  let head = src.slice(ini + abre.length, fim);

  head = head.replace(/<!--[\s\S]*?-->/g, "");
  head = head.replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, "");
  head = head.replace(/<title>[\s\S]*?<\/title>/gi, "");
  head = head.replace(/<meta\s+(?:name|property)="(?:description|author|keywords|robots|theme-color|application-name|mobile-web-app-capable|apple-mobile-web-app-[a-z-]+|og:[a-z:_]+|twitter:[a-z:_]+)"[^>]*>/gi, "");
  head = head.replace(/<link\s+rel="(?:canonical|alternate|icon|shortcut icon|apple-touch-icon|manifest)"[^>]*>/gi, "");
  head = head.replace(/\n[ \t]*(?=\n)/g, "");

  const novo = [
    `<title>${atr(cab.titulo)}</title>`,
    `<meta name="description" content="${atr(cab.descricao)}" />`,
    `<meta name="robots" content="${atr(cab.robots)}" />`,
    `<link rel="canonical" href="${atr(cab.canonical)}" />`,
    cab.icone ? `<link rel="icon" type="image/svg+xml" href="${atr(cab.icone)}" />` : "",
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${atr(cab.nome)}" />`,
    `<meta property="og:title" content="${atr(cab.titulo)}" />`,
    `<meta property="og:description" content="${atr(cab.descricao)}" />`,
    `<meta property="og:url" content="${atr(cab.canonical)}" />`,
    `<meta property="og:image" content="${atr(cab.imagem)}" />`,
    `<meta property="og:locale" content="${atr(cab.idioma || "en_US")}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${atr(cab.titulo)}" />`,
    `<meta name="twitter:description" content="${atr(cab.descricao)}" />`,
    `<meta name="twitter:image" content="${atr(cab.imagem)}" />`,
    cab.ld ? `<script type="application/ld+json" id="tenant-ld">${jsonSeguro(cab.ld)}</script>` : "",
    `<script type="application/json" id="tenant-boot">${jsonSeguro(boot || {})}</script>`,
  ].filter(Boolean).join("\n    ");

  // Logo depois do viewport (título cedo no documento); sem viewport, no começo do head.
  const vp = head.match(/<meta\s+name="viewport"[^>]*>/i);
  head = vp
    ? head.replace(vp[0], () => `${vp[0]}\n    ${novo}`)
    : `\n    ${novo}${head}`;

  return src.slice(0, ini) + abre + head + src.slice(fim);
}

// ── robots.txt e sitemap.xml DO HOST DO CLIENTE ──────────────────────────────────────────────
/** Não indexável: a página já sai com noindex (meta + cabeçalho). O robots NÃO bloqueia o
    rastreio — bloqueado, o Google não leria o noindex e poderia listar a URL nua. */
export function robotsTxtDoCliente({ host, indexable = false }) {
  const h = normalizarHost(host);
  if (!h) return null;
  const linhas = ["User-agent: *", "Allow: /", "Disallow: /api/", ""];
  if (indexable === true) linhas.push(`Sitemap: https://${h}/sitemap.xml`, "");
  return linhas.join("\n");
}

const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

/** Raiz + uma URL por unidade. Não indexável → urlset válido e vazio (nunca um convite a indexar). */
export function sitemapDoCliente({ slug, host, indexable = false }) {
  const v = VITRINES[slug];
  const h = normalizarHost(host);
  if (!v || !h) return null;
  const urls = indexable === true
    ? [`https://${h}/`, ...v.unidades.map((u) => `https://${h}/${u.caminho}`)]
    : [];
  const corpo = urls.map((u, i) => `  <url>\n    <loc>${xml(u)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${i === 0 ? "1.0" : "0.8"}</priority>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${corpo}${corpo ? "\n" : ""}</urlset>\n`;
}

// ── RASTREIO DO CLIENTE ──────────────────────────────────────────────────────────────────────
/** IDs como o banco aceita. Qualquer outra coisa vira "" — nunca um valor cru dentro do HTML. */
export const pixelValido = (v) => (/^[0-9]{5,20}$/.test(String(v || "").trim()) ? String(v).trim() : "");
export const tagValida = (v) => (/^(G|AW|GTM)-[A-Z0-9]{4,20}$/.test(String(v || "").trim().toUpperCase()) ? String(v).trim().toUpperCase() : "");

/** O bloco de dados que o servidor entrega ao React. Só o que a página precisa — nunca o e-mail do cliente. */
export function bootDoCliente(linha) {
  return {
    slug: String(linha?.slug || ""),
    kind: String(linha?.kind || ""),
    host: normalizarHost(linha?.host) || "",
    indexable: linha?.indexable === true,
    pixelMeta: pixelValido(linha?.pixel_meta),
    tagGoogle: tagValida(linha?.tag_google),
  };
}
