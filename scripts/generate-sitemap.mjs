// Programmatic sitemap generator. Enumerates every public URL from the data sources
// (verticals × cities matrix, blog, static) so the sitemap never goes stale when we add a
// city, vertical or combo page. Run: `npm run sitemap` (also wired into the build).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const { SEO_VERTICALS } = await import(resolve(root, "src/data/seoVerticals.js"));
const { SEO_CITIES } = await import(resolve(root, "src/data/seoCities.js"));
const { BLOG_POSTS } = await import(resolve(root, "src/data/blogPosts.js"));

const SITE = "https://guileoai.com";
// lastmod must reflect when CONTENT actually changed — stamping build-date on all 900+ URLs
// every deploy teaches Google to ignore our lastmod. Bump manually on real content changes;
// blog posts carry their own post.date.
const CONTENT_DATE = "2026-07-01";

// Static, hand-curated pages (priority/changefreq tuned).
const STATIC = [
  ["/", "weekly", "1.0"],
  ["/servicos", "weekly", "0.9"],
  ["/lead-generation", "weekly", "0.9"],
  ["/calculator", "monthly", "0.7"],
  ["/marketing", "monthly", "0.7"],
  ["/planos", "monthly", "0.8"],
  ["/home-services", "monthly", "0.7"],
  ["/go-live", "monthly", "0.7"],
  ["/quiz", "monthly", "0.5"],
  ["/grader", "monthly", "0.5"],
  ["/nossa-gente", "monthly", "0.5"],
  ["/partners", "monthly", "0.5"],
  ["/live", "weekly", "0.4"],
  ["/compliance", "yearly", "0.3"],
  ["/privacy", "yearly", "0.3"],
  ["/terms", "yearly", "0.3"],
  ["/refunds", "yearly", "0.3"],
  ["/contact", "yearly", "0.3"],
  ["/blog", "weekly", "0.7"],
  ["/portal", "monthly", "0.4"],
];

const urls = [];
const add = (loc, changefreq, priority, lastmod = CONTENT_DATE) => urls.push({ loc: SITE + loc, changefreq, priority, lastmod });

STATIC.forEach(([loc, cf, pr]) => add(loc, cf, pr));

// Blog posts (unique slugs across languages) — lastmod = the post's real publish date
[...new Set(BLOG_POSTS.map((p) => p.slug))].forEach((slug) => {
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  add(`/blog/${slug}`, "monthly", "0.6", post?.date || CONTENT_DATE);
});

// Verticals
SEO_VERTICALS.forEach((v) => add(`/for/${v.slug}`, "weekly", "0.8"));

// Cities — receptionist + lead-gen variants
SEO_CITIES.forEach((c) => {
  add(`/ai-receptionist/${c.slug}`, "monthly", c.hq ? "0.9" : "0.8");
  add(`/lead-generation/${c.slug}`, "monthly", "0.8");
});

// Vertical × City matrix (the long-tail mesh)
SEO_VERTICALS.forEach((v) => {
  SEO_CITIES.forEach((c) => add(`/for/${v.slug}/${c.slug}`, "monthly", "0.7"));
});

const body = urls
  .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(resolve(root, "public/sitemap.xml"), xml);
console.log(`✓ sitemap.xml generated — ${urls.length} URLs (${SEO_VERTICALS.length} verticals × ${SEO_CITIES.length} cities = ${SEO_VERTICALS.length * SEO_CITIES.length} combos)`);
