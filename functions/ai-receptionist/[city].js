// SEO route: /ai-receptionist/:city — per-city OG/title/description for social crawlers.
import { langFromUrl, pick, rewriteOg, SITE, DEFAULT_IMAGE } from "../lib/ogMeta.js";
import { getSeoCity } from "../../src/data/seoCities.js";

export async function onRequestGet(context) {
  try {
    const slug = context.params.city;
    const c = getSeoCity(slug);
    if (!c) return context.next();
    const lang = langFromUrl(context.request.url);
    return rewriteOg(context, {
      title: pick(c.seoTitle, lang),
      description: pick(c.seoDesc, lang),
      url: `${SITE}/ai-receptionist/${slug}`,
      image: DEFAULT_IMAGE,
    });
  } catch {
    return context.next();
  }
}

export const onRequest = (c) => (c.request.method === "GET" ? onRequestGet(c) : c.next());
