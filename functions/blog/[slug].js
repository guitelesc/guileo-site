// SEO route: /blog/:slug — per-post OG/title/description for social crawlers.
// Blog posts are NOT trilingual objects; each post is a row with a `lang` field.
// findPost(slug, lang) returns the lang match, else any-lang match, else null.
import { langFromUrl, rewriteOg, SITE, DEFAULT_IMAGE } from "../lib/ogMeta.js";
import { findPost } from "../../src/data/blogPosts.js";

export async function onRequestGet(context) {
  try {
    const slug = context.params.slug;
    const lang = langFromUrl(context.request.url);
    const post = findPost(slug, lang);
    if (!post) return context.next();
    return rewriteOg(context, {
      title: `${post.title} | Guileo`,
      description: post.metaDesc || post.excerpt || "",
      url: `${SITE}/blog/${slug}`,
      image: DEFAULT_IMAGE,
    });
  } catch {
    return context.next();
  }
}

export const onRequest = (c) => (c.request.method === "GET" ? onRequestGet(c) : c.next());
