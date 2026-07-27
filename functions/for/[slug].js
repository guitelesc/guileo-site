// SEO route: /for/:slug — per-vertical OG/title/description for social crawlers.
import { langFromUrl, pick, rewriteOg, SITE, DEFAULT_IMAGE } from "../lib/ogMeta.js";
import { getSeoVertical } from "../../src/data/seoVerticals.js";

export async function onRequestGet(context) {
  try {
    const slug = context.params.slug;
    const v = getSeoVertical(slug);
    // Unknown vertical → REAL 404 (the SPA shell would soft-404 with a 200 + homepage meta,
    // wasting crawl budget). Serve the shell so the SPA's NotFound still renders, but status 404.
    if (!v) {
      const res = await context.next();
      return new Response(res.body, { status: 404, headers: res.headers });
    }
    const lang = langFromUrl(context.request.url);
    return rewriteOg(context, {
      title: pick(v.seoTitle, lang),
      description: pick(v.seoDesc, lang),
      url: `${SITE}/for/${slug}`,
      image: DEFAULT_IMAGE,
    });
  } catch {
    return context.next();
  }
}

export const onRequest = (c) => (c.request.method === "GET" ? onRequestGet(c) : c.next());
