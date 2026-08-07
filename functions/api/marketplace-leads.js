// Cloudflare Pages Function — POST /api/marketplace-leads  · MARKETPLACE LEAD-RESPONDER
// ─────────────────────────────────────────────────────────────────────────────
// SPEED-TO-LEAD for Yelp / Angi / Thumbtack + REALTOR leads (Zillow / StreetEasy): a lead
// lands on the marketplace → this endpoint
// ingests it (Zapier/Make webhook, or a forwarded lead-notification email parsed here) → CRM
// contact → Gui CALLS the lead back in ~60s through the SINGLE HARDENED dial gate (/api/call:
// DNC + caps — we never dial around it) → owner alerted (branded email). 78% buy from whoever
// answers first — Gui answers first.
//
// LIVE today: webhook/Zapier/email-forward ingestion + Gui callback + CRM + owner alert.
// PENDING (honest): the official Yelp Leads API needs partner approval — yelp_connect/yelp_status
// are inert scaffolds ({ready:false}) like mindbody.js until that lands. Zillow has NO public
// lead API without a Premier Agent partnership and StreetEasy has none at all — for both, the
// email-forward/Zapier path IS the integration (parsed below). Never fake.
// For zillow/streeteasy the LISTING ADDRESS is stored in the `service` field.
//
// TWO FACES (all POST, per-tenant gated by email + connection key via get_client_data — the
// same gate as noshow-radar.js; the key can ride in the URL so no-code tools need zero config):
//   INGEST (what a Zapier/Make recipe or an email-forward parser posts):
//     POST /api/marketplace-leads?client=<tenant email>&token=<connection key>
//       body { name, phone, email, service, message, source }        ← structured webhook
//       body { raw: "<full lead-notification email text>" }          ← we parse best-effort
//   TENANT actions (cockpit): { action:"list", email, token, limit? }
//                             { action:"set_status", email, token, id, status }
//   SCAFFOLD (inert):         { action:"yelp_connect" | "yelp_status", email, token }
// Needs db/marketplace_leads.sql pasted; until then ingest returns a graceful ready:false note.
// Zillow/StreetEasy sources ALSO need db/realtor_leads.sql (extends mkt_lead_record's source
// whitelist) — without it the base function safely maps them to 'other', nothing is lost.
// ─────────────────────────────────────────────────────────────────────────────
import { json, rateLimited } from "../lib/guard.js";
import { ownerAlertEmail } from "../lib/emailTemplates.js";
import { emitFailure } from "../lib/failure.js";
import { svcRpc } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

const SOURCE_LABEL = { yelp: "Yelp", angi: "Angi", thumbtack: "Thumbtack", zillow: "Zillow", streeteasy: "StreetEasy", other: "the web" };
const s = (v, n = 200) => (v == null ? "" : v.toString().slice(0, n));

// ── BEST-EFFORT PARSER for forwarded marketplace lead-notification emails ─────
// Tolerant regexes over the raw text — formats drift, so every extraction is optional and the
// full raw text is ALWAYS stored (raw jsonb) so nothing is ever lost even when parsing misses.
function detectSource(raw, hinted) {
  const h = (hinted || "").toString().toLowerCase();
  if (["yelp", "angi", "thumbtack", "zillow", "streeteasy"].includes(h)) return h;
  const t = (raw || "").toLowerCase();
  if (/yelp/.test(t)) return "yelp";
  if (/angi|homeadvisor|angie'?s list/.test(t)) return "angi";
  if (/thumbtack/.test(t)) return "thumbtack";
  if (/street\s*easy/.test(t)) return "streeteasy"; // before zillow — StreetEasy is a Zillow Group brand and its emails mention Zillow
  if (/zillow|trulia|hotpads/.test(t)) return "zillow";
  return "other";
}
function parseRawLead(raw) {
  const t = raw.replace(/\r/g, "");
  const out = { name: "", phone: "", email: "", service: "" };
  // NAME — Yelp: "You have a new lead from Maria S." · Angi: "Customer: Maria" · generic "Name: Maria"
  //        Zillow: "New contact: Maria S." / "Maria S. is interested in …" · StreetEasy: "Maria contacted you about …"
  // Words never cross a newline ([ \t] only); brand names are never a person ("New contact
  // from Zillow" → a brand-only capture is rejected and the NEXT pattern gets its shot).
  const BRAND = /\b(?:zillow|street\s*easy|streeteasy|yelp|angi|homeadvisor|thumbtack|trulia|hotpads|premier[ \t]agent)\b/gi;
  const W = "[A-Za-zÀ-ÿ'.-]+(?:[ \\t][A-Za-zÀ-ÿ'.-]+){0,3}";
  const NAME_PATTERNS = [
    new RegExp("(?:new (?:lead|request|message|project|contact) from|lead from)[ \\t]+(" + W + ")", "i"),
    /^\s*(?:new[ \t])?contact\s*[:\-]\s*(.+)$/im, // Zillow labeled line "New contact: Sarah Lopez"
    /^\s*(?:customer|client|name|nome)\s*[:\-]\s*(.+)$/im,
    new RegExp("(" + W + ")[ \\t]+(?:sent you a (?:message|request)|is interested|requested an? (?:quote|tour|showing|application)|contacted you|would like to (?:see|tour|view)|is requesting)", "i"),
  ];
  for (const re of NAME_PATTERNS) {
    const m = t.match(re);
    if (!m) continue;
    const name = m[1].split("\n")[0].trim().replace(/[.,;:!]+$/, "")
      .replace(BRAND, " ").replace(/\s{2,}/g, " ").trim()
      .replace(/^(?:on|from|via|the)[ \t]+/i, "").replace(/[ \t]+(?:on|from|via)$/i, "")
      .replace(/[.,;:!-]+$/, "").trim();
    if (name.length >= 2) { out.name = name.slice(0, 120); break; }
  }
  // PHONE — first US-shaped number anywhere in the text (labels vary too much to trust)
  const ph = t.match(/(\+?1?[\s.(-]{0,2}\d{3}[\s.)-]{0,2}\d{3}[\s.-]?\d{4})(?!\d)/);
  if (ph) out.phone = ph[1].replace(/[^0-9+]/g, "").slice(0, 20);
  // EMAIL — a plain address in the body (skip the marketplaces' own notification senders)
  const em = t.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g) || [];
  out.email = (em.find((e) => !/@(yelp|angi|homeadvisor|thumbtack|angieslist|zillow|streeteasy|trulia|hotpads|convo\.zillow)\./i.test(e)) || "").toLowerCase().slice(0, 160);
  // SERVICE — Yelp: "Service: House Cleaning" · Thumbtack: "Project: …" · "requesting/looking for …"
  // REALTOR (Zillow/StreetEasy): the LISTING ADDRESS is the service — "is interested in 123 Main St #4B",
  // "contacted you about 55 W 25th St", "Listing: …" / "Property: …" / "Regarding: …" labeled lines.
  // Digit-leading captures allow commas ("123 Main St, Apt 4B, Brooklyn"); word-leading ones stop at commas.
  const sv = t.match(/^\s*(?:service|project|category|servi[cç]o|job type|listing|property|address|regarding|im[oó]vel)\s*[:\-]\s*(.+)$/im)
    || t.match(/(?:is interested in|interested in your (?:listing|property|rental|home)(?: at)?|inquir(?:ed|ing) about|contacted you about|sent you a message about|would like to (?:see|tour|view)|requested an? (?:tour|showing) (?:of|at|for))\s+(?:a\s+|an\s+|the\s+)?(\d[^\n.;]{3,90}|[^\n.,;]{3,80})/i)
    || t.match(/(?:requesting|looking for|needs?|interested in|quote for)\s+(?:a\s+|an\s+)?([^\n.,]{3,80})/i);
  if (sv) out.service = sv[1].trim().replace(/[.,;]+$/, "").slice(0, 160);
  return out;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const u = new URL(request.url);
    const b = await request.json().catch(() => ({}));
    // PER-TENANT GATE — email↔connection-key via get_client_data (identical to noshow-radar.js /
    // mindbody.js). The pair may ride in the URL (?client=&token=) so a Zapier recipe is one paste.
    // No OWNER_EMAIL fallback — a wrong key can never write into (or read from) another tenant.
    // Accept both spellings in the URL (?client=&token= per the docs, ?email=&key= per the
    // cockpit's copy-paste link) — a no-code recipe must never 401 on a synonym.
    let email = (b.email || b.client || u.searchParams.get("client") || u.searchParams.get("email") || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || u.searchParams.get("token") || u.searchParams.get("key") || "").toString().trim();
    const action = (b.action || "ingest").toString();

    // ── AUTENTICAÇÃO POR SLUG (site do cliente) ──────────────────────────────────
    // O formulário do site PÚBLICO do cliente não pode carregar a chave de conexão dele
    // (ficaria no HTML, à vista de qualquer visitante). Em vez disso ele manda só o slug,
    // e nós resolvemos slug→tenant no servidor via client_site_owner (service-role).
    // Restrito a `ingest`: um slug NUNCA lê a lista de leads nem muda status — só entrega
    // um lead novo, que é exatamente o que um formulário público precisa poder fazer.
    const siteSlug = (b.site_slug || "").toString().trim().toLowerCase();
    let viaSlug = false;
    if (!email && siteSlug && action === "ingest") {
      try {
        const or_ = await svcRpc(env, "client_site_owner", { p_secret: env.INGEST_SECRET || "", p_slug: siteSlug });
        const owner = or_ && or_.ok ? ((await or_.json().catch(() => "")) || "").toString().trim().toLowerCase() : "";
        if (owner.includes("@")) { email = owner; viaSlug = true; }
      } catch { /* slug inválido/não publicado → cai no 401 abaixo */ }
    }

    if (!email.includes("@")) return json({ error: "unauthorized" }, 401);
    if (!viaSlug) {
      if (!key) return json({ error: "unauthorized" }, 401);
      const gd = await rpc("get_client_data", { p_email: email, p_key: key });
      if (!gd.ok) return json({ error: "unauthorized" }, 401);
      const gdj = await gd.json().catch(() => null);
      if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);
    }

    // ── TENANT: list ──
    if (action === "list") {
      const r = await rpc("mkt_leads_list", { p_secret: env.INGEST_SECRET || "", p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 100, 1), 500) });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/marketplace_leads.sql in Supabase to activate the lead responder.", leads: [] });
      return json({ ok: true, ready: true, leads: (await r.json().catch(() => [])) || [] });
    }

    // ── TENANT: set_status ──
    if (action === "set_status") {
      const id = (b.id || "").toString().trim();
      const status = (b.status || "").toString().trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return json({ error: "bad id" }, 400);
      if (!["new", "called", "converted", "lost"].includes(status)) return json({ error: "bad status" }, 400);
      const r = await rpc("mkt_lead_status", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: id, p_status: status });
      if (!r.ok) return json({ ok: false, note: "Paste db/marketplace_leads.sql in Supabase to activate the lead responder." });
      return json({ ok: true, updated: (await r.json().catch(() => false)) === true });
    }

    // ── SCAFFOLD (inert, honest): the official Yelp Leads API needs partner approval — same
    //    pattern as mindbody.js. Until approved, ingestion works via Zapier/Make/email-forward.
    if (action === "yelp_connect" || action === "yelp_status") {
      return json({ ok: true, ready: false, note: "Yelp Leads API precisa de aprovação de parceiro — até lá, conecte via Zapier/Make ou encaminhamento de email (funciona hoje)." });
    }
    if (action !== "ingest") return json({ error: "unknown action" }, 400);

    // ── INGEST — webhooks re-deliver and no-code tools misfire, so this face NEVER 500s on
    //    garbage: bad input gets a 200 + ok:false so Zapier doesn't hard-retry forever. ──
    // Rate limit: generous for real lead volume, fatal for a runaway loop (fail-open — a KV
    // blip must never drop a real lead; mkt_lead_record's dedupe + call-claim bound the damage).
    if (await rateLimited(request, env, "mkt-ingest", 30, 60)) return json({ error: "too many requests" }, 429);

    const rawText = s(b.raw, 8000);
    const parsed = rawText ? parseRawLead(rawText) : { name: "", phone: "", email: "", service: "" };
    const source = detectSource(rawText, b.source || u.searchParams.get("source"));
    const lead = {
      name: s(b.name, 120) || parsed.name,
      phone: (s(b.phone, 40) || parsed.phone).replace(/[^0-9+]/g, ""),
      email: (s(b.email, 160) || parsed.email).toLowerCase(),
      service: s(b.service, 160) || parsed.service,
      message: s(b.message, 800),
    };
    if (!lead.phone && !lead.email) return json({ ok: false, note: "no phone or email found in the payload" });

    // 1) RECORD (idempotent — a re-delivered webhook returns the existing row, duplicate:true)
    const rr = await rpc("mkt_lead_record", {
      p_secret: env.INGEST_SECRET || "", p_email: email, p_source: source,
      p_name: lead.name, p_phone: lead.phone, p_contact_email: lead.email,
      p_service: lead.service, p_message: lead.message,
      p_raw: rawText ? { raw: rawText } : b,
    });
    if (!rr.ok) {
      await emitFailure(env, "mkt_lead_record_failed", email, `marketplace lead from ${source} NOT stored — paste db/marketplace_leads.sql`, { source });
      return json({ ok: true, ready: false, note: "Paste db/marketplace_leads.sql in Supabase to activate the lead responder." });
    }
    const rec = (await rr.json().catch(() => ({}))) || {};
    const leadId = rec.id || "";
    const duplicate = rec.duplicate === true;

    // 2) CRM SPINE — every marketplace lead becomes a contact (lead_source = the marketplace).
    //    Best-effort, same crm_upsert_contact pattern as lead.js / delivery-webhook.js.
    if (env.SCHED_SECRET && !duplicate) {
      try {
        await svcRpc(env, "crm_upsert_contact", { p_secret: env.SCHED_SECRET, p_email: email, p_phone: lead.phone, p_contact_email: lead.email, p_name: lead.name || "", p_source: `marketplace:${source}`, p_amount_cents: 0 });
      } catch { /* CRM is additive — never block the ingest */ }
    }

    // 3) SPEED-TO-LEAD — Gui calls the lead back in ~60s, EXACTLY ONCE (atomic claim), and ONLY
    //    through the hardened /api/call gate (DNC + fail-closed caps live THERE — never dial around it).
    let calling = false;
    if (leadId && lead.phone && env.ELEVENLABS_API_KEY && env.ELEVENLABS_PHONE_NUMBER_ID) {
      try {
        const cl = await rpc("mkt_lead_call_claim", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: leadId });
        const won = cl.ok && (await cl.json().catch(() => false)) === true;
        if (won) {
          // BRAKE — same GLOBAL 50/day auto-call ceiling + 12h per-phone cooldown as lead.js
          // (shared KV keys, so marketplace + website auto-calls share ONE cost/abuse budget).
          let blocked = false;
          if (env.RATE_LIMIT) {
            try {
              if (await env.RATE_LIMIT.get(`callph:${lead.phone}`)) blocked = true;
              if (!blocked) {
                const dk = `callday:${new Date().toISOString().slice(0, 10)}`;
                const n = parseInt((await env.RATE_LIMIT.get(dk)) || "0", 10);
                if (n >= 50) blocked = true;
                else await env.RATE_LIMIT.put(dk, String(n + 1), { expirationTtl: 172800 });
              }
            } catch { /* KV blip → call.js's fail-closed caps backstop */ }
          }
          if (!blocked) {
            const origin = new URL(request.url).origin;
            if (env.RATE_LIMIT) { try { await env.RATE_LIMIT.put(`callph:${lead.phone}`, "1", { expirationTtl: 43200 }); } catch { /* caps backstop */ } }
            // THROUGH the hardened gate — /api/call re-checks DNC + per-destination cooldown itself.
            await fetch(`${origin}/api/call`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Origin: origin, "x-guileo-internal": env.DIGEST_TOKEN || "" },
              body: JSON.stringify({ phone: lead.phone, name: lead.name, need: `returning your ${lead.service || "service"} request from ${SOURCE_LABEL[source]}`, lang: "auto", client_email: email }),
            });
            calling = true;
          }
        }
      } catch { /* speed-to-lead is best-effort — the lead is already stored */ }
    }

    // 4) OWNER ALERT — branded "you just got a lead" email to the tenant, instantly (kind: lead).
    if (env.RESEND_API_KEY && !duplicate) {
      try {
        const det = [SOURCE_LABEL[source], lead.service, lead.message, lead.phone || lead.email, calling ? "Gui is calling them back now" : ""].filter(Boolean).join(" · ").slice(0, 400);
        const { subject, html } = ownerAlertEmail({ kind: "lead", customer: lead.name || lead.phone || lead.email, details: det, lang: "en" });
        await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: email, subject, html }),
        });
      } catch { /* alert is best-effort — never block the ingest */ }
    }

    return json({ ok: true, id: leadId, source, duplicate, calling });
  } catch {
    return json({ ok: false }, 200); // 200 so Zapier/Make doesn't hard-retry on our parse hiccup
  }
}
