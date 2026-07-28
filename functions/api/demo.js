// Cloudflare Pages Function — POST /api/demo · the DEMO ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// A prospect gives ONE input (their website URL, Instagram @, or brand name) and we
// pull their REAL brand to render a sellable, personalized preview of any Guileo product.
// Actions (JSON body {action,...}):
//   brand      → fetch the site, extract a BRAND KIT (name, tagline, facts, colors, logo, services)
//   screenshot → live screenshot URL of the site IF env.SCREENSHOT_API set, else inert-que-acende
//   save       → persist a demo, return {ok, demo_token}
//   get        → return a saved demo's brand kit (public /demo/:token page)
//   lead       → log a demo lead (captured in CRM)
//   view       → log a demo view (analytics)
//
// HONEST: brand fields not found → empty, never invented. Screenshot never faked.
// Security: sameOrigin + per-IP rate limit on public POSTs; RPCs gated by the INGEST literal
// (server-held env.INGEST_SECRET), never echoed. Everything additive.
// ─────────────────────────────────────────────────────────────────────────────
import { json, sameOrigin, rateLimited } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const s = (v, n = 400) => (v == null ? "" : v.toString().slice(0, n));
const INGEST = (env) => env.INGEST_SECRET || "glo_ing_7f3da9c2b4e8";

const MODEL_CHAIN = ["claude-fable-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"];

// ── helpers ──────────────────────────────────────────────────────────────────

// Normalize a raw user input into a fetchable https URL, or "" if it's a bare @handle/name.
function normalizeUrl(raw) {
  let v = s(raw, 300).trim();
  if (!v) return "";
  if (v.startsWith("@")) return ""; // instagram handle — no site to fetch
  if (!/^https?:\/\//i.test(v)) {
    // a token with a dot and no spaces is a domain; otherwise it's a brand name
    if (/\s/.test(v) || !v.includes(".")) return "";
    v = "https://" + v;
  }
  try {
    const u = new URL(v);
    // SSRF guard (audit): only fetch PUBLIC hosts. Block loopback/link-local/private/metadata so a
    // crafted "url" can't make our server probe internal addresses. Hostnames that resolve privately
    // still can't reach anything on Cloudflare's edge, but we refuse the obvious ones outright.
    const h = u.hostname.toLowerCase();
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "[::1]" || h === "::1") return "";
    if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return "";
    if (!h.includes(".")) return ""; // bare hostnames (no TLD) → not a public site
    return u.toString();
  } catch { return ""; }
}

// Strip HTML → readable text for the summarizer. Drops script/style, collapses whitespace.
function htmlToText(html) {
  return s(html, 400000)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

// Best-effort brand COLORS from inline styles / theme-color meta. Honest: none found → {}.
function extractColors(html) {
  const out = {};
  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  if (theme) out.primary = s(theme[1], 24).trim();
  const hexes = (html.match(/#[0-9a-fA-F]{6}\b/g) || [])
    .map((h) => h.toLowerCase())
    .filter((h) => h !== "#ffffff" && h !== "#000000");
  if (!out.primary && hexes.length) out.primary = hexes[0];
  if (hexes.length) {
    const accent = hexes.find((h) => h !== out.primary);
    if (accent) out.accent = accent;
  }
  return out;
}

// Best-effort LOGO url: og:image → apple-touch-icon → favicon link → /favicon.ico. Absolute-ized.
function extractLogo(html, base) {
  const abs = (u) => { try { return new URL(s(u, 500).trim(), base).toString(); } catch { return ""; } };
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) return abs(og[1]);
  const apple = html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
  if (apple) return abs(apple[1]);
  const icon = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
  if (icon) return abs(icon[1]);
  return abs("/favicon.ico");
}

// Summarize fetched page text → a structured brand kit via Claude (model chain). Strict JSON.
async function summarizeBrand(env, text, hintName) {
  if (!env.ANTHROPIC_API_KEY) return null;
  const system = `You extract a factual brand kit from a business website's text. Reply with ONLY valid JSON, no markdown, no preamble. Shape:
{"name":"","tagline":"","facts":"","services":[{"name":"","price":""}]}
RULES: Use ONLY information present in the text. If a field is not found, use "" (or [] for services). NEVER invent a business name, service, or price. "tagline" = one short line describing what the business does. "facts" = a compact factual paragraph (hours, location, specialties, what to know) usable as an AI receptionist's brain. "services" = up to 8 real offerings; include "price" only if a price actually appears, else "".`;
  const user = `Website text${hintName ? ` for "${hintName}"` : ""}:\n\n${text}`;
  for (const model of MODEL_CHAIN) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 900, system, messages: [{ role: "user", content: user }] }),
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        let t = (d?.content?.[0]?.text || "").trim();
        const m = t.match(/\{[\s\S]*\}/);
        if (m) { try { return JSON.parse(m[0]); } catch { /* try next */ } }
      } else if (r.status === 401 || r.status === 402) {
        break; // auth/billing won't be fixed by another model
      }
    } catch { /* try next model */ }
  }
  return null;
}

// ── action handlers ──────────────────────────────────────────────────────────

async function doBrand(env, b) {
  const rawUrl = s(b.url, 300).trim();
  const handle = s(b.handle, 120).trim();
  const name = s(b.name, 160).trim();
  const url = normalizeUrl(rawUrl || handle || name);

  // No fetchable site (bare @handle or plain brand name) → honest empty kit seeded with the name.
  if (!url) {
    const seedName = name || (handle ? handle.replace(/^@/, "") : "");
    return json({ ok: true, name: seedName, tagline: "", facts: "", colors: {}, logo: "", services: [], source: handle ? "handle" : "name" });
  }

  let html = "";
  try {
    const resp = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GuileoDemoBot/1.0; +https://guileoai.com)", Accept: "text/html" },
      cf: { cacheTtl: 300 },
    });
    if (resp.ok) html = await resp.text();
  } catch { /* leave html empty → honest empty kit below */ }

  if (!html) return json({ ok: true, name, tagline: "", facts: "", colors: {}, logo: "", services: [], source: "url", note: "site não acessível" });

  const colors = extractColors(html);
  const logo = extractLogo(html, url);
  const text = htmlToText(html);
  const kit = (await summarizeBrand(env, text, name)) || {};

  const services = Array.isArray(kit.services)
    ? kit.services.filter((x) => x && x.name).map((x) => ({ name: s(x.name, 120), price: s(x.price, 40) })).slice(0, 8)
    : [];

  return json({
    ok: true,
    name: s(kit.name || name, 160),
    tagline: s(kit.tagline, 240),
    facts: s(kit.facts, 4000),
    colors,
    logo,
    services,
    source: "url",
  });
}

// Live screenshot URL — ONLY if env.SCREENSHOT_API is set. Never faked (inert-que-acende).
function doScreenshot(env, b) {
  const url = normalizeUrl(s(b.url, 300).trim());
  if (!url) return json({ ready: false, note: "sem URL para captura" });
  if (!env.SCREENSHOT_API) return json({ ready: false, note: "aguardando SCREENSHOT_API" });
  // env.SCREENSHOT_API is a URL template; {url} is replaced with the encoded target,
  // otherwise the encoded target is appended as a query param.
  const enc = encodeURIComponent(url);
  const tpl = s(env.SCREENSHOT_API, 500);
  const shot = tpl.includes("{url}")
    ? tpl.replace("{url}", enc)
    : tpl + (tpl.includes("?") ? "&" : "?") + "url=" + enc;
  return json({ ready: true, url: shot });
}

async function doSave(env, b) {
  const brand = (b.brand && typeof b.brand === "object") ? b.brand : b;
  try {
    const r = await rpc("demo_save", { p_secret: INGEST(env), p_brand: brand });
    if (!r.ok) return json({ ok: false, error: "save failed" }, 500);
    const token = s(await r.json(), 200).replace(/^"|"$/g, "");
    if (!token) return json({ ok: false, error: "save failed" }, 500);
    return json({ ok: true, demo_token: token });
  } catch { return json({ ok: false, error: "save failed" }, 500); }
}

async function doGet(env, b) {
  const token = s(b.demo_token || b.token, 200).trim();
  if (!token) return json({ ok: false, error: "no token" }, 400);
  try {
    const r = await rpc("demo_get", { p_secret: INGEST(env), p_token: token });
    if (!r.ok) return json({ ok: false, error: "not found" }, 404);
    const brand = await r.json().catch(() => null);
    if (!brand) return json({ ok: false, error: "not found" }, 404);
    return json({ ok: true, brand });
  } catch { return json({ ok: false, error: "not found" }, 404); }
}

async function doEvent(env, b, kind) {
  const token = s(b.demo_token || b.token, 200).trim();
  const product = s(b.product, 120).trim();
  const contact = kind === "lead"
    ? { name: s(b.name, 160), email: s(b.email, 200), contact: s(b.contact, 200), brand: s(b.brand?.name || b.brand, 200) }
    : { brand: s(b.brand?.name || b.brand, 200) };
  try {
    await rpc("demo_event", { p_secret: INGEST(env), p_token: token, p_kind: kind, p_product: product, p_contact: contact });
  } catch { /* analytics best-effort — never block the demo */ }
  return json({ ok: true });
}

// plan → the canonical, ALREADY-AUDITED Stripe Payment Link (the 3 KEEP_URLS in
// setup-selfserve.js). We ONLY ever redirect to these — the demo creates no new charge
// surface, so there is no new money code to audit here.
const PLAN_LINKS = {
  starter: "https://buy.stripe.com/bJe9AT9LldnecqjdzT3Nm0e", // Essential  $149
  growth:  "https://buy.stripe.com/4gM7sL9Ll0AsgGz2Vf3Nm0f", // Personalized $449 (default)
  scale:   "https://buy.stripe.com/bJe00j6z94QI2PJ0N73Nm0g", // Full Operation $999
};

// CHECKOUT: hand back the plan's Payment Link URL with the demo attribution stapled on.
// Stripe copies client_reference_id onto the resulting Checkout Session → stripe-webhook
// logs checkout_done (funnel close). This NEVER touches credits — attribution only.
async function doCheckout(env, b) {
  const token = s(b.demo_token || b.token, 200).trim();
  const product = s(b.product, 120).trim();
  const planIn = s(b.plan, 20).trim();
  const planKey = ["starter", "growth", "scale"].includes(planIn) ? planIn : "growth";
  const base = PLAN_LINKS[planKey];
  if (!base) return json({ ok: false, error: "no link" }, 400);
  // client_reference_id must be [A-Za-z0-9_-]; token is 64-hex, product is a slug.
  const ref = ("demo_" + token + "_" + product).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 190);
  const q = new URLSearchParams({ client_reference_id: ref });
  const email = s(b.email, 200).trim();
  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) q.set("prefilled_email", email);
  // best-effort funnel log; never blocks the redirect
  try { await rpc("demo_event", { p_secret: INGEST(env), p_token: token, p_kind: "checkout_start", p_product: product, p_contact: { plan: planKey } }); } catch { /* analytics best-effort */ }
  return json({ ok: true, url: base + "?" + q.toString(), plan: planKey });
}

// STATS: funnel counts for a token ('' = global). Counts only, no PII. Secret-gated.
async function doStats(env, b) {
  const token = s(b.demo_token || b.token, 200).trim();
  try {
    const r = await rpc("demo_stats", { p_secret: INGEST(env), p_token: token });
    if (!r.ok) return json({ ok: false, stats: {} }, 200);
    const stats = await r.json().catch(() => null);
    return json({ ok: true, stats: stats || {} });
  } catch { return json({ ok: false, stats: {} }, 200); }
}

// ── router ───────────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "demo", 40)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = s(b.action, 40).trim();

    switch (action) {
      case "brand":      return await doBrand(env, b);
      case "screenshot": return doScreenshot(env, b);
      case "save":       return await doSave(env, b);
      case "get":        return await doGet(env, b);
      case "lead":       return await doEvent(env, b, "lead");
      case "view":       return await doEvent(env, b, "view");
      case "checkout":   return await doCheckout(env, b);
      case "stats":      return await doStats(env, b);
      default:           return json({ error: "unknown action" }, 400);
    }
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
