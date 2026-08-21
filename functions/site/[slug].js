// SEO **e APP** da rota /site/:slug — o site do cliente visto por um crawler e por um celular.
//
// POR QUE ISTO EXISTE (SEO): WhatsApp, Facebook, LinkedIn e a primeira passada do Google leem o
// HTML CRU. A página é React, então sem isto o link do site de um cliente compartilhado no
// WhatsApp mostraria o título e a descrição da GUILEO — não o negócio dele. Num produto que
// se vende como "o site do seu negócio", isso é o defeito mais visível possível.
//
// POR QUE ISTO CRESCEU (APP): o mesmo problema, elevado. A casca estática do index.html carrega
// `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` e `theme-color: #161512` — ou seja,
// o iPhone de um cliente do restaurante instalaria o site na tela inicial com a LOGO DA GUILEO e
// a cor da Guileo. Regra desta casa: nunca a nossa marca dentro do app de outro negócio. Então o
// <head> desta rota é reescrito com a identidade REAL do negócio + o link do manifesto por tenant.
//
// Mesmo rewriteOg() usado por /for/* e /blog/* — um só caminho de reescrita, testado.
// Site não publicado / slug inexistente → context.next(): o React renderiza o "não
// encontrado" normalmente, nenhuma meta de cliente vaza pra uma página que não existe, e nenhum
// manifesto/app nasce para um slug que não está no ar.
import { rewriteOg, SITE, DEFAULT_IMAGE } from "../lib/ogMeta.js";
import { carregarSite, descricao, caminhos } from "../lib/sitePwa.js";
// DADOS ESTRUTURADOS NO HTML DO SERVIDOR. Modelo de IA (e boa parte dos rastreadores) NÃO executa
// JavaScript: tudo que só aparece depois do React montar simplesmente não existe para eles. Por
// isso o JSON-LD do negócio sai aqui, no SSR, e não no cliente. Mesma família da armadilha do apex
// que já custou caro: o conteúdo estava lá, no lugar que ninguém consultava.
import { blocoJsonLd } from "../lib/dadosEstruturados.js";
import { svcJson } from "../lib/sb.js";

// Escapa o que vai virar valor de atributo. Os dados vêm do cadastro do cliente — nome de negócio
// com aspas existe, e uma aspa solta aqui quebraria a tag.
const attr = (v) => String(v == null ? "" : v).replace(/[<>"&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "&": "&amp;" }[c])).slice(0, 200);

// Troca o <head> da casca pela identidade do NEGÓCIO e pendura o manifesto do app dele.
function cabecaDoApp(html, site, extra) {
  const p = caminhos(site.slug);

  // 1. Ícone de tela inicial do iOS: era o da Guileo na casca estática. Agora é o do negócio.
  html = html.replace(/<link\s+rel="apple-touch-icon"[^>]*>/i,
    `<link rel="apple-touch-icon" href="${p.icone192}" />`);
  // 2. Favicon da aba/atalho — mesmo motivo.
  html = html.replace(/<link\s+rel="icon"[^>]*>/gi, "");
  // 2b. O MANIFESTO DA GUILEO. A casca declara /manifest.webmanifest (o app do cockpit, escopo
  //     /portal). Se ele sobrar aqui, o <head> do site do cliente sai com DOIS manifestos e o
  //     celular escolhe o primeiro — instalando o app do negócio dele com o nome, a cor e o ícone
  //     da Guileo. Some antes de pendurar o manifesto do tenant, logo abaixo.
  html = html.replace(/<link\s+rel="manifest"[^>]*>/gi, "");
  // 2c. As metas de app do iOS (nome/cor da barra) também são nossas na casca — o bloco abaixo
  //     reescreve todas com a identidade do negócio, então as originais precisam sair primeiro.
  html = html.replace(/<meta\s+name="(apple-mobile-web-app-(capable|title|status-bar-style)|mobile-web-app-capable|application-name)"[^>]*>/gi, "");
  // 3. Cor do tema: a barra do navegador e a moldura do app instalado ficam na cor da marca dele.
  html = html.replace(/<meta\s+name="theme-color"[^>]*>/i,
    `<meta name="theme-color" content="${attr(site.cor)}" />`);

  const tags = [
    `<link rel="icon" type="image/png" href="${p.icone192}" />`,
    `<link rel="manifest" href="${p.manifest}" />`,
    // iOS não lê display/name do manifesto na hora de "Adicionar à Tela de Início" — lê estas.
    `<meta name="apple-mobile-web-app-capable" content="yes" />`,
    `<meta name="mobile-web-app-capable" content="yes" />`,
    `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`,
    `<meta name="apple-mobile-web-app-title" content="${attr(site.curto)}" />`,
    `<meta name="application-name" content="${attr(site.curto)}" />`,
    `<link rel="alternate" type="text/markdown" href="/site/aeo/${site.slug}.txt" />`,
    blocoJsonLd(site, extra),
  ].filter(Boolean).join("\n    ");

  return html.includes("</head>") ? html.replace("</head>", `    ${tags}\n  </head>`) : html;
}

export async function onRequestGet(context) {
  try {
    const slug = String(context.params.slug || "").toLowerCase();
    const site = await carregarSite(slug);
    if (!site) return context.next();
    const d = site.bruto;
    // Horário/moeda vêm de uma RPC separada; se ela falhar o JSON-LD sai MENOR (endereço e
    // serviços), nunca errado. Dado ausente é omissão; dado chutado é mentira estruturada.
    let extra = { hours: {}, faqPublico: [], tz: "" };
    try {
      const c = await svcJson(context.env, "client_site_aeo",
        { p_secret: context.env?.INGEST_SECRET || "", p_slug: slug });
      if (c && c.ok === true && c.found === true) extra = { hours: c.hours || {}, faqPublico: [], tz: c.tz || "" };
    } catch { /* sem horário o grafo sai menor, nunca errado */ }

    const city = site.cidade;
    // A descrição usa o texto do PRÓPRIO dono quando existe; senão, um resumo montado só
    // com fato (cidade + serviços reais). Nunca uma frase de marketing inventada.
    const svc = (d.services || []).slice(0, 3).map((s) => s.name).filter(Boolean).join(", ");
    const desc = site.sobre
      || [city ? `${site.nome} em ${city}.` : `${site.nome}.`, svc ? `${svc}.` : "", "Fale com a gente — respondemos na hora."]
         .filter(Boolean).join(" ");

    const res = await rewriteOg(context, {
      title: city ? `${site.nome} · ${city}` : site.nome,
      description: (desc || descricao(site)).slice(0, 300),
      url: `${SITE}/site/${slug}`,
      image: d.config?.hero_url || d.config?.logo_url || DEFAULT_IMAGE,
    });

    // rewriteOg devolve a casca só quando ela veio 200/text/html; se algo saiu do padrão, ela
    // devolve a resposta original intacta — nesse caso não mexemos no <head> (melhor um app sem
    // manifesto do que um HTML costurado errado).
    const ct = res.headers.get("content-type") || "";
    if (res.status !== 200 || !ct.includes("text/html")) return res;
    let html;
    try { html = await res.text(); } catch { return res; }

    const headers = new Headers(res.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(cabecaDoApp(html, site, extra), { status: 200, headers });
  } catch {
    return context.next();
  }
}

export const onRequest = (c) => (c.request.method === "GET" ? onRequestGet(c) : c.next());
