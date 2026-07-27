// Shared helper for the SEO route Pages Functions. Social crawlers (WhatsApp,
// Facebook, Twitter/X, LinkedIn) DON'T run JS — they read the static index.html,
// which only carries generic OG tags. These functions sit in front of the SEO
// routes, fetch the normal SPA HTML via context.next(), and use Cloudflare
// HTMLRewriter to swap ONLY the <head> meta/title/canonical for the page-specific
// values. The body, #root and module scripts pass through untouched, so the page
// still boots as an SPA.

export const SITE = "https://guileoai.com";
export const DEFAULT_IMAGE = SITE + "/og.jpg";

// ?lang=pt|es|hi|en, default "en". Hindi falls back to EN copy (no trilingual hi).
export function langFromUrl(url) {
  let lang = "en";
  try {
    const q = new URL(url).searchParams.get("lang");
    if (q) lang = q.toLowerCase();
  } catch { /* keep default */ }
  if (lang === "hi") return "en";
  if (["pt", "es", "en"].includes(lang)) return lang;
  return "en";
}

// Handles trilingual objects {en,pt,es} AND plain strings.
export function pick(field, lang) {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field[lang] || field.en || field.pt || "";
}

// Strip angle brackets + quotes defensively so a value can't break out of an attribute.
function clean(v) {
  return (v == null ? "" : String(v)).replace(/[<>"]/g, "").replace(/\s+/g, " ").trim();
}

// Replace the content="" of a <meta name|property="key"> (order-independent) via a function
// replacement so `$` in the value is never treated as a backref.
function setMetaContent(html, key, value) {
  const re = new RegExp(`(<meta\\s+(?:name|property)="${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s+content=")[^"]*(")`, "i");
  if (re.test(html)) return html.replace(re, (_m, a, b) => a + value + b);
  // also handle content-before-key ordering
  const re2 = new RegExp(`(<meta\\s+content=")[^"]*("\\s+(?:name|property)="${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}")`, "i");
  return re2.test(html) ? html.replace(re2, (_m, a, b) => a + value + b) : html;
}

// meta = { title, description, url, image? }
// Text-replacement (not HTMLRewriter) — bulletproof against Content-Encoding/streaming 1101s.
export async function rewriteOg(context, meta) {
  const res = await context.next();
  const ct = res.headers.get("content-type") || "";
  if (res.status !== 200 || !ct.includes("text/html")) return res;

  let html;
  try { html = await res.text(); } catch { return res; }

  const title = clean(meta.title);
  const description = clean(meta.description);
  const url = clean(meta.url);
  const image = meta.image ? clean(meta.image) : "";
  if (!title) return new Response(html, res); // nothing to set → serve as-is

  html = html.replace(/<title>[^<]*<\/title>/i, () => `<title>${title}</title>`);
  html = setMetaContent(html, "description", description);
  html = setMetaContent(html, "og:title", title);
  html = setMetaContent(html, "og:description", description);
  html = setMetaContent(html, "og:url", url);
  html = setMetaContent(html, "twitter:title", title);
  html = setMetaContent(html, "twitter:description", description);
  if (image) { html = setMetaContent(html, "og:image", image); html = setMetaContent(html, "twitter:image", image); }
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, (_m, a, b) => a + url + b);

  // hreflang must be SELF-referential: the static shell hardcodes homepage alternates, which is
  // invalid on every other route (Google requires each page to point at ITS OWN language variants).
  // Rewrite all 5 alternates to this page's URL (+ ?lang=x — the pattern the SPA toggle honors).
  const base = url.split("?")[0];
  html = html.replace(/<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="[^"]*"\s*\/?>/gi,
    (_m, hl) => `<link rel="alternate" hreflang="${hl}" href="${hl === "x-default" || hl === "en" ? base : `${base}?lang=${hl}`}" />`);

  const headers = new Headers(res.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(html, { status: 200, headers });
}
