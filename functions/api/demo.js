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
const INGEST = (env) => env.INGEST_SECRET || "";

// MODEL_CHAIN vem de ../lib/guiBrain.js — NÃO declare outra aqui (2026-08-12).
// Eram DEZ cópias idênticas da mesma lista de modelos, uma por arquivo. Idênticas HOJE: conferi as
// dez antes de mexer, e é exatamente por estarem iguais que a hora de unificar é agora — depois que
// uma diverge, alguém já foi atendido pelo modelo errado e ninguém sabe qual superfície foi.
// É o padrão que esta sessão inteira perseguiu: cópia sem vínculo com a fonte.
import { MODEL_CHAIN } from "../lib/guiBrain.js";

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
  const src = s(html, 400000);
  // FIRST capture structured data BEFORE stripping <script> — schema.org JSON-LD (LocalBusiness/
  // Restaurant/Organization) carries the REAL name/hours/address/phone/menu/priceRange even on
  // JS-rendered sites where the visible HTML is thin; <title>+meta description/og summarize the
  // business. This is what makes the demo pitch "super real" instead of generic.
  const head = [];
  const title = src.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) head.push("TITLE: " + title[1].replace(/<[^>]+>/g, " ").trim());
  for (const re of [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:(?:title|description)["'][^>]+content=["']([^"']+)["']/gi,
  ]) {
    const all = src.match(re); if (all) head.push((Array.isArray(all) ? all.join(" · ") : all[1]).replace(/<[^>]*content=["']|["'][^>]*>/g, " "));
  }
  let ld = "";
  const blocks = src.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of blocks.slice(0, 6)) {
    ld += " " + b.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").replace(/\s+/g, " ").trim().slice(0, 3500);
  }
  const structured = (head.join(" · ") + (ld ? "  SCHEMA: " + ld : "")).replace(/\s+/g, " ").trim();
  const body = src
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (structured + "\n\n" + body).trim().slice(0, 15000);
}

// Best-effort brand COLORS from inline styles / theme-color meta. Honest: none found → {}.
function extractColors(html) {
  const out = {};
  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  if (theme) out.primary = s(theme[1], 24).trim();
  // Site moderno raramente tem #rrggbb no HTML — a cor vive no CSS externo, em hex de 3
  // dígitos ou em rgb(). Só o padrão de 6 dígitos deixava a demo SEM COR na maioria dos
  // prospects, que é justamente o que ela promete ("na marca do cliente").
  const hex3to6 = (h) => "#" + h.slice(1).split("").map((c) => c + c).join("").toLowerCase();
  const rgbToHex = (r, g, b) => "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, +n)).toString(16).padStart(2, "0")).join("");
  const hexes = [
    ...(html.match(/#[0-9a-fA-F]{6}\b/g) || []).map((h) => h.toLowerCase()),
    ...(html.match(/#[0-9a-fA-F]{3}\b/g) || []).map(hex3to6),
    ...[...html.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)].map((m) => rgbToHex(m[1], m[2], m[3])),
  ].filter((h) => h !== "#ffffff" && h !== "#000000");
  if (!out.primary && hexes.length) out.primary = hexes[0];
  if (hexes.length) {
    const accent = hexes.find((h) => h !== out.primary);
    if (accent) out.accent = accent;
  }
  return out;
}

// Best-effort LOGO url: og:image → apple-touch-icon → favicon link → /favicon.ico. Absolute-ized.
function extractLogo(html, base) {
  // SÓ http(s) vale como logo. Sem este filtro, um favicon inline (data:…) ou um href
  // quebrado virava a string "data:;" — que é TRUTHY, então a vitrine renderizava uma
  // imagem quebrada em cima do pitch em vez de cair no fallback. Melhor logo nenhum do
  // que ícone quebrado na tela do prospect.
  const abs = (u) => {
    try {
      const url = new URL(s(u, 500).trim(), base);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      return url.toString();
    } catch { return ""; }
  };
  // Cadeia de tentativas: um candidato REJEITADO (data:, href quebrado) não pode encerrar a
  // busca — tem que cair no próximo. Antes, um og:image inline zerava o logo de um site que
  // tinha apple-touch-icon perfeitamente válido logo abaixo.
  const tries = [
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i),
    html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i),
    html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i),
  ];
  for (const m of tries) {
    if (!m) continue;
    const u = abs(m[1]);
    if (u) return u;
  }
  return abs("/favicon.ico");
}

// Summarize fetched page text → a structured brand kit via Claude (model chain). Strict JSON.
// ⚠️ ELE PRECISA DIZER POR QUE FALHOU (24/08). Antes, toda falha virava `null` e o chamador
// preenchia com um modelo do setor + a nota "proteção anti-bot ou página em JS". Para o
// nonstopplumbers.com essa nota era FALSA: o site entrega 7.758 caracteres perfeitamente legíveis
// e o logo foi extraído do HTML — o que quebrou foi ESTA etapa. Uma causa inventada é pior que
// nenhuma: mandou a gente investigar o site do cliente em vez do nosso próprio código.
// `_motivo` é diagnóstico, não texto de tela.
async function summarizeBrand(env, text, hintName, diag = {}) {
  if (!env.ANTHROPIC_API_KEY) { diag.motivo = "ANTHROPIC_API_KEY ausente"; return null; }
  const system = `You extract a factual brand kit from a business website's text. Reply with ONLY valid JSON, no markdown, no preamble. Shape:
{"name":"","tagline":"","facts":"","services":[{"name":"","price":""}]}
RULES: Use ONLY information present in the text. If a field is not found, use "" (or [] for services). NEVER invent a business name, service, or price. "tagline" = one short line describing what the business does. "facts" = a compact factual paragraph (hours, location, specialties, what to know) usable as an AI receptionist's brain. "services" = up to 8 real offerings; include "price" only if a price actually appears, else "".`;
  const user = `Website text${hintName ? ` for "${hintName}"` : ""}:\n\n${text}`;
  // Overall ~10s budget on the demo path: a slow model must never stall the pitch. Each call gets a
  // per-request AbortController bounded by the remaining budget; once it's spent we stop trying.
  const deadline = Date.now() + 10000;
  for (const model of MODEL_CHAIN) {
    const remaining = deadline - Date.now();
    if (remaining <= 500) break; // out of budget — return null → honest colors/logo-only kit
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), remaining);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 900, system, messages: [{ role: "user", content: user }] }),
        signal: ctrl.signal,
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        let t = (d?.content?.[0]?.text || "").trim();
        const m = t.match(/\{[\s\S]*\}/);
        if (m) { try { return JSON.parse(m[0]); } catch { /* try next */ } }
        diag.motivo = `modelo ${model} respondeu sem JSON`;
      } else {
        let corpo = ""; try { corpo = (await r.text()).slice(0, 180); } catch { /* */ }
        diag.motivo = `HTTP ${r.status} em ${model}: ${corpo}`;
        // 🚨 A ANTHROPIC DEVOLVE 400 QUANDO O SALDO ACABA, não 402 (24/08). O teste só olhava
        // 401/402, então "sem crédito" não era reconhecido como problema de billing: a corrente
        // tentava TODOS os modelos, um a um, queimando os 10s de orçamento para receber o mesmo
        // 400 — e no fim reportava um genérico. Saldo é a única falha que nenhum outro modelo
        // resolve; sair na primeira é o certo, e dizer o nome dela é o que faltava.
        const semSaldo = /credit balance is too low|insufficient.*credit/i.test(corpo);
        if (semSaldo) { diag.motivo = "SEM SALDO ANTHROPIC — recarregar em console.anthropic.com"; break; }
        if (r.status === 401 || r.status === 402) { diag.motivo = `billing/auth ${r.status}`; break; }
      }
    } catch (e) { diag.motivo = `${String(e).slice(0, 60)} em ${model}`; }
    finally { clearTimeout(timer); }
  }
  return null;
}

// SUPER-REAL FALLBACK — when the scrape is thin (bot-blocked / JS shell / timeout), the demo still
// gets a rich, vertical-typical brain so it never sounds generic. ILLUSTRATIVE only: first-person
// context true of ANY business in that vertical — NO invented prices, addresses, or specifics.
const INDUSTRY_TEMPLATES = {
  restaurant: { tagline: "Reservations, takeout & questions — answered 24/7", facts: "We take table reservations, takeout and delivery orders, and answer questions about hours, the menu, and private events. Gui picks up every call day and night, books tables, starts takeout orders, and captures catering leads so nothing is missed at the host stand.", services: ["Table reservation", "Takeout order", "Catering / private event", "Hours & menu questions"] },
  dental: { tagline: "New patients & appointments — never a missed call", facts: "We book cleanings, checkups, and new-patient visits, handle rescheduling, and answer insurance and hours questions. Gui answers 24/7, fills open chairs, confirms appointments to cut no-shows, and captures every new-patient call — even after hours.", services: ["Book appointment", "New patient intake", "Reschedule / confirm", "Insurance & hours questions"] },
  medical: { tagline: "Patients booked & questions answered, 24/7", facts: "We schedule visits, handle rescheduling and reminders, and answer hours, location, and service questions. Gui answers every call, books and confirms appointments to reduce no-shows, and routes urgent needs to a human — so no patient goes unanswered.", services: ["Book appointment", "Reschedule / confirm", "New patient intake", "Hours & services questions"] },
  salon: { tagline: "Every booking captured — even after hours", facts: "We book cuts, color, nails, facials, and treatments, manage rescheduling, and answer pricing and availability questions. Gui answers 24/7, fills the calendar, confirms to cut no-shows, and rebooks regulars so no chair sits empty.", services: ["Book appointment", "Reschedule / confirm", "Pricing & availability", "Rebook a regular"] },
  home: { tagline: "Every job lead answered & scheduled fast", facts: "We take service requests, quote typical jobs, schedule visits, and handle urgent calls. Gui answers 24/7, captures the job details, books the visit, flags emergencies to a human immediately, and follows up on every estimate so no lead goes cold.", services: ["Schedule a service visit", "Request a quote", "Emergency / urgent", "Follow up on an estimate"] },
  realestate: { tagline: "Never miss a buyer or seller lead", facts: "We field buyer and seller inquiries, book showings, answer listing and pricing questions, and route hot leads fast. Gui answers 24/7, qualifies the lead, books the showing, and follows up so no prospect slips away.", services: ["Book a showing", "Buyer / seller inquiry", "Listing & pricing questions", "Lead follow-up"] },
  gym: { tagline: "Trials booked & members supported, 24/7", facts: "We book tours and free trials, answer membership and class questions, and handle scheduling. Gui answers every call, books trials, follows up with prospects, and helps members with class times and plans so no sign-up is missed.", services: ["Book a tour / trial", "Membership questions", "Class schedule", "Prospect follow-up"] },
  law: { tagline: "Every potential client captured & screened", facts: "We take new-client inquiries, screen matters, book consultations, and answer practice and hours questions. Gui answers 24/7, captures the case details, books the consult, and routes urgent matters — so no potential client is lost to voicemail.", services: ["Book a consultation", "New client intake", "Practice area questions", "Urgent matter routing"] },
  auto: { tagline: "Service & sales calls answered instantly", facts: "We book service appointments, answer parts and pricing questions, and capture sales inquiries. Gui answers 24/7, schedules service, follows up on quotes, and routes sales leads so no customer waits on hold.", services: ["Book a service appointment", "Parts & pricing questions", "Sales inquiry", "Quote follow-up"] },
  default: { tagline: "Answers, books & sells — 24/7", facts: "We answer questions about hours, pricing, and availability, book appointments, quote jobs, and follow up on leads. Gui picks up every call and message day and night, captures each customer, books the work, and follows up so no call or sale is ever missed.", services: ["Answer & book", "Quote a price", "Capture the lead", "Follow up"] },
};
function inferIndustry(t) {
  const x = (t || "").toLowerCase();
  if (/restaurant|caf[eé]|coffee|deli|pizz|kitchen|grill|eatery|bakery|bistro|dining|cheesecake|taco|sushi|steak|burger|brew/.test(x)) return "restaurant";
  if (/dental|dentist|orthodont|\bsmile/.test(x)) return "dental";
  if (/clinic|medical|doctor|physician|derma|health|wellness|med\s?spa|pediatric|urgent care/.test(x)) return "medical";
  if (/salon|\bspa\b|beauty|\bhair|\bnail|barber|lash|\bbrow|aesthetic|waxing/.test(x)) return "salon";
  if (/plumb|hvac|heating|cooling|\belectric|roofing|clean|landscap|contractor|handyman|pest|garage|remodel|paint/.test(x)) return "home";
  if (/realty|real estate|realtor|properties|\bhomes\b|mortgage|listing/.test(x)) return "realestate";
  if (/\bgym\b|fitness|yoga|pilates|crossfit|\btraining|martial|\bmma\b/.test(x)) return "gym";
  if (/\blaw\b|attorney|\blegal\b|lawyer|firm/.test(x)) return "law";
  if (/\bauto|\bcar\b|dealership|mechanic|\btire|motors|collision/.test(x)) return "auto";
  return "default";
}

// ── action handlers ──────────────────────────────────────────────────────────

async function doBrand(env, b) {
  // The landing/DemoEngine sends ONE field `query`; sellers/admin may send url/handle/name.
  // Accept all. Return the kit BOTH wrapped in `brand` (what the UI reads) AND flat (curl/back-compat).
  const query = s(b.query, 300).trim();
  const rawUrl = s(b.url, 300).trim() || (query && !query.startsWith("@") ? query : "");
  const handle = s(b.handle, 120).trim() || (query.startsWith("@") ? query : "");
  const explicitName = s(b.name, 160).trim();
  const url = normalizeUrl(rawUrl || handle);
  const reply = (kit) => json({ ok: true, brand: kit, ...kit });
  // a human-readable seed name from whatever was typed (@handle → handle, domain.com → domain).
  const seedName = explicitName || s(query || rawUrl || handle, 160)
    .replace(/^@/, "").replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
    .replace(/\.(com|net|org|io|co|app|us|br|shop|store|me)(\.[a-z]{2})?$/i, "").trim();

  // No fetchable site (bare @handle or plain brand name) → honest kit seeded with the NAME the visitor
  // typed (never invented) so the preview still personalizes and the lead is never dead-ended.
  if (!url) {
    const tpl = INDUSTRY_TEMPLATES[inferIndustry(seedName)] || INDUSTRY_TEMPLATES.default;
    return reply({ name: seedName, tagline: tpl.tagline, facts: tpl.facts, colors: {}, logo: "", services: tpl.services.map((n) => ({ name: n, price: "" })), source: (handle || query.startsWith("@")) ? "handle" : "name" });
  }

  let html = "";
  try {
    // Hard 7s cap on the external site pull — a slow/hanging site must never freeze the pitch.
    // On abort/timeout the fetch throws → we fall through to the honest name-seeded kit below.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const resp = await fetch(url, {
        redirect: "follow",
        // Real browser UA + full Accept — many business sites (Squarespace/Wix/Magento) serve a thin
        // JS shell (empty facts) to obvious bots but full server-rendered HTML to a browser. This is a
        // one-page preview of the site the visitor themselves typed (like Slack/Twitter link previews).
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        cf: { cacheTtl: 300 },
        signal: ctrl.signal,
      });
      if (resp.ok) html = await resp.text();
    } finally { clearTimeout(timer); }
  } catch { /* leave html empty → honest name-seeded kit below (timeout/abort included) */ }

  if (!html) {
    const tpl = INDUSTRY_TEMPLATES[inferIndustry(seedName)] || INDUSTRY_TEMPLATES.default;
    return reply({ name: seedName, tagline: tpl.tagline, facts: tpl.facts, colors: {}, logo: "", services: tpl.services.map((n) => ({ name: n, price: "" })), source: "url", note: "site não acessível" });
  }

  let colors = extractColors(html);
  // A cor de um site moderno quase nunca está no HTML — está na folha de estilo. Sem este
  // passo a demo saía SEM COR pra maioria dos prospects, e "vitrine na marca do cliente"
  // virava um card cinza genérico. Uma folha só, com teto de tempo e de tamanho: se demorar
  // ou vier gigante, seguimos sem cor em vez de travar o pitch.
  if (!colors.primary) {
    try {
      const cssHref = (html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/i)
        || html.match(/<link[^>]+href=["']([^"']+\.css[^"']*)["']/i))?.[1];
      if (cssHref) {
        const cssUrl = new URL(cssHref, url).toString();
        if (/^https?:$/.test(new URL(cssUrl).protocol)) {
          const cr = await fetch(cssUrl, { signal: AbortSignal.timeout(2500), headers: { "user-agent": "GuileoDemoBot/1.0" } });
          if (cr.ok) {
            const css = (await cr.text()).slice(0, 120000);
            const fromCss = extractColors(css);
            if (fromCss.primary) colors = fromCss;
          }
        }
      }
    } catch { /* sem cor é honesto; travar o pitch não é */ }
  }
  const logo = extractLogo(html, url);
  const text = htmlToText(html);
  const _diag = {};
  const kit = (await summarizeBrand(env, text, explicitName || seedName, _diag)) || {};

  let services = Array.isArray(kit.services)
    ? kit.services.filter((x) => x && x.name).map((x) => ({ name: s(x.name, 120), price: s(x.price, 40) })).slice(0, 8)
    : [];

  const finalName = s(kit.name || explicitName || seedName, 160);
  let tagline = s(kit.tagline, 240);
  let facts = s(kit.facts, 4000);
  // SUPER-REAL FALLBACK: scrape came back thin (bot-blocked / JS shell / timeout) → fill the brain
  // with an illustrative, vertical-typical template so the demo is always rich. Real name/colors/logo
  // stay on top; industry inferred from the name + whatever text we did get. No invented specifics.
  let generic = false;
  if (!facts && services.length === 0) {
    const tpl = INDUSTRY_TEMPLATES[inferIndustry(`${finalName} ${text}`)] || INDUSTRY_TEMPLATES.default;
    tagline = tagline || tpl.tagline;
    facts = tpl.facts;
    services = tpl.services.map((n) => ({ name: n, price: "" }));
    generic = true;
  }

  // O fallback acima é bom (demo nunca fica vazia) mas era SILENCIOSO: a resposta dizia
  // source:"url" como se tivéssemos lido o site, quando na prática só o nome era do cliente.
  // Muitos sites (WordPress atrás de proteção, SPA) entregam página cheia ao navegador e uma
  // casca vazia a IP de datacenter — foi o que aconteceu com naturaspanyc.com. O vendedor
  // precisa SABER disso antes de mostrar pro prospect, senão leva um "não é isso que a gente
  // faz" na frente do cliente. `generic` diz a verdade; quem consome decide o que fazer.
  return reply({
    name: finalName, tagline, facts, colors, logo, services, source: "url",
    // por que a extracao falhou — some quando ela funciona
    motivo_generic: generic ? (_diag.motivo || "") : "",
    // O SITE, GUARDADO (2026-08-15). A demo é CONSTRUÍDA a partir da URL e depois só sobravam os
    // derivados (nome, cores, logo) — a URL, que é o dado bruto, era jogada fora. Isso deixava a
    // análise do prospect (ROTA-ANALISE) sem o único campo de que ela precisa, num fluxo onde o
    // dado já estava na mão. Guardar aqui é aditivo: nada que lê `brand` hoje enxerga a chave nova.
    site: url || "",
    generic,
    ...(generic ? { note: `nao consegui montar a ficha a partir do texto do site${_diag.motivo ? ` (${_diag.motivo})` : ""} — conteudo abaixo e TIPICO DO SETOR, nao do negocio` } : {}),
  });
}

// Live screenshot URL — ONLY if env.SCREENSHOT_API is set. Never faked (inert-que-acende).
function doScreenshot(env, b) {
  const url = normalizeUrl(s(b.url, 300).trim());
  if (!url) return json({ ready: false, note: "sem URL para captura" });
  if (!env.SCREENSHOT_API) return json({ ready: false, note: "aguardando SCREENSHOT_API" });
  // Template de URL do provedor. DOIS marcadores, porque os provedores discordam:
  //   {url}      → alvo CODIFICADO (quem recebe a URL como query param)
  //   {raw_url}  → alvo CRU, no caminho (thum.io e afins; com a URL codificada dão 400)
  // Sem {raw_url} a plataforma ficava presa a um estilo só de provedor.
  const enc = encodeURIComponent(url);
  const tpl = s(env.SCREENSHOT_API, 500);
  const shot = tpl.includes("{raw_url}")
    ? tpl.replace("{raw_url}", url)
    : tpl.includes("{url}")
      ? tpl.replace("{url}", enc)
      : tpl + (tpl.includes("?") ? "&" : "?") + "url=" + enc;
  return json({ ready: true, url: shot });
}

async function doSave(env, b) {
  // fold the chosen product into the saved brand JSON so a reopened /vitrine link restores it
  // (demo_save only persists p_brand; no separate column needed).
  const base = (b.brand && typeof b.brand === "object") ? b.brand : b;
  const pid = s(b.productId || b.product, 60).trim();
  const brand = pid ? { ...base, _product: pid } : base;
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
    return json({ ok: true, brand, productId: (brand && brand._product) || "" });
  } catch { return json({ ok: false, error: "not found" }, 404); }
}

async function doEvent(env, b, kind, request, context) {
  let analise = null;   // visibilidade do gatilho da análise (ver bloco no fim)
  const token = s(b.demo_token || b.token, 200).trim();
  const product = s(b.product || b.productId, 120).trim(); // UI sends `productId`; sellers send `product`
  const brandName = s(b.brand?.name || b.brand, 200);
  const contact = kind === "lead"
    ? { name: s(b.name, 160), email: s(b.email, 200), contact: s(b.contact, 200), brand: brandName }
    : { brand: brandName };
  try {
    await rpc("demo_event", { p_secret: INGEST(env), p_token: token, p_kind: kind, p_product: product, p_contact: contact });
  } catch { /* analytics best-effort — never block the demo */ }

  // A DEMO LEAD is a HOT prospect — don't let it die as an analytics row. Forward it into the real
  // lead funnel (/api/lead) so the OWNER gets alerted, it lands in the CRM, and speed-to-lead can
  // fire. Best-effort; never blocks the demo response.
  if (kind === "lead" && request) {
    const c = s(b.contact || b.email, 200).trim();
    if (c) {
      try {
        const origin = new URL(request.url).origin;
        await fetch(`${origin}/api/lead`, {
          method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
          body: JSON.stringify({
            name: s(b.name, 120), contact: c, email: s(b.email, 160),
            business: brandName, source: "demo",
            message: `Interessado na demo personalizada${product ? " · " + product : ""}${brandName ? " · " + brandName : ""}`,
            lang: s(b.lang, 5) || "pt",
          }),
        });
      } catch { /* lead forward is best-effort */ }

      // ── O GATILHO DA ANÁLISE (2026-08-15) ────────────────────────────────────────────────
      // «ele já ganha isso só de marcar a demo». Marcou → a gente lê o site dele e manda os 3
      // achados + o link da página. Vale antes da call: o prospect vê que já trabalhamos por ele,
      // e o vendedor entra sabendo onde dói.
      //
      // ⚠️ FALHA EM SILÊNCIO, DE PROPÓSITO. Se o site estiver atrás de captcha (metade deles) ou
      // não render achado nenhum, NÃO sai e-mail. "Não conseguimos ler seu site" como presente de
      // boas-vindas é pior que presente nenhum — e é a primeira impressão da Guileo, que não tem
      // segunda chance. Sem site, sem análise, sem e-mail: a demo segue igual.
      //
      // Nunca bloqueia nem atrasa a resposta da demo: `waitUntil` solta em segundo plano. A demo
      // é o momento mais frágil do funil; nada novo pode segurá-la.
      const siteProspect = s(b.brand?.site || b.site, 300).trim();
      // Por que ele NÃO disparou fica registrado. A 1ª versão saía calada nas três condições e a
      // única prova era "não apareceu linha no banco" — que é igual pra causa nenhuma.
      analise = { site: !!siteProspect, token: !!env.DIGEST_TOKEN, ctx: !!context?.waitUntil, disparado: false };
      if (siteProspect && env.DIGEST_TOKEN && context?.waitUntil) {
        analise.disparado = true;
        const origin = new URL(request.url).origin;
        context.waitUntil(fetch(`${origin}/api/diagnostico`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: env.DIGEST_TOKEN, site: siteProspect, contato: c,
            nome: s(b.name, 60), lang: s(b.lang, 2) || "en", seller: s(b.seller, 160),
            enviar: true,
          }),
        }).catch(() => {}));
      }
    }
  }
  return json({ ok: true, ...(analise ? { analise } : {}) });
}

// plan → the canonical, ALREADY-AUDITED Stripe Payment Link (the 3 KEEP_URLS in
// setup-selfserve.js). We ONLY ever redirect to these — the demo creates no new charge
// surface, so there is no new money code to audit here.
const PLAN_LINKS = {
  starter: "https://buy.stripe.com/bJe9AT9LldnecqjdzT3Nm0e", // Essential  $149
  growth:  "https://buy.stripe.com/eVq9ATaPp4QIcqjdzT3Nm0l", // Personalized $897 (default) — repreço 2026-08-21
  scale:   "https://buy.stripe.com/4gM8wP6z9gzqcqj2Vf3Nm0m", // Full Operation $1.997 — repreço 2026-08-21
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
      case "lead":       return await doEvent(env, b, "lead", request, context);
      case "view":       return await doEvent(env, b, "view");
      case "checkout":   return await doCheckout(env, b);
      case "stats":      return await doStats(env, b);
      default:           return json({ error: "unknown action" }, 400);
    }
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
