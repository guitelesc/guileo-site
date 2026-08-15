// GET /sitemap-clientes.xml — O SITEMAP DOS SITES DOS CLIENTES.
//
// ── POR QUE UM SITEMAP SEPARADO ────────────────────────────────────────────────────────────────
// public/sitemap.xml é GERADO NO BUILD (scripts/generate-sitemap.mjs) a partir de arquivos de
// dados do repositório: 59 cidades × 13 verticais, blog, páginas fixas. Site de cliente não vem
// de arquivo — nasce quando um dono clica "publicar" no cockpit, entre dois deploys. Um sitemap
// de build NUNCA saberia dele; ficaria certo por acidente e errado na hora que importa.
//
// Então este é vivo: lê os sites publicados do banco a cada requisição. Publicou → está no
// sitemap em minutos. Despublicou → sai. É a única forma de o sitemap não mentir.
//
// Dois sitemaps convivem sem índice: robots.txt aceita várias linhas `Sitemap:` (ver o patch de
// public/robots.txt no relatório desta onda). Nada em public/sitemap.xml precisa mudar.
//
// Cada cliente publicado rende DUAS URLs:
//   /site/:slug       → a página de venda dele
//   /site/aeo/:slug   → o documento de respostas (fatos em texto liso + JSON-LD)
// A segunda é a que existe para ser LIDA por quem não executa JavaScript.
//
// published=false não aparece: a RPC client_sites_publicos já filtra no banco, então nem chega
// aqui a chance de vazar um rascunho.
import { svcJson } from "./lib/sb.js";

const SITE = "https://guileoai.com";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

export async function onRequestGet(context) {
  let sites = [];
  try {
    const d = await svcJson(context.env, "client_sites_publicos", { p_secret: context.env?.INGEST_SECRET || "" });
    if (d && d.ok === true && Array.isArray(d.sites)) sites = d.sites;
  } catch { /* abaixo */ }

  // Falha de leitura → sitemap VÁLIDO e VAZIO, nunca um 500. Um sitemap quebrado faz o Google
  // desconfiar do arquivo inteiro; um sitemap vazio só não acrescenta nada nesta passada.
  const urls = sites
    .filter((s) => s && /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(String(s.slug || "")))
    .flatMap((s) => {
      const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(String(s.lastmod || "")) ? s.lastmod : null;
      const m = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
      return [
        `  <url>\n    <loc>${esc(`${SITE}/site/${s.slug}`)}</loc>${m}\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
        `  <url>\n    <loc>${esc(`${SITE}/site/aeo/${s.slug}`)}</loc>${m}\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
      ];
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=600, s-maxage=600" },
  });
}

export const onRequest = (c) => (c.request.method === "GET" ? onRequestGet(c) : c.next());
