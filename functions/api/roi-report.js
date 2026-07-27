// Cloudflare Pages Function — POST /api/roi-report → emails the prospect a branded,
// HONEST revenue-at-risk estimate right after they try the live demo.
// Body: { name, email?, phone, business, industry, lang }
// If no email is provided we skip silently (returns ok) — the call/lead flow is never blocked.
// The numbers mirror src/components/ResultsV2.jsx / src/data/seoVerticals.js `lose` values
// (industry-average monthly loss from missed calls) and the email labels them as an ESTIMATE.
import { sameOrigin, rateLimited } from "../lib/guard.js";
import { roiReportEmail } from "../lib/emailTemplates.js";

// industry keyword → estimated $ lost/month (same figures the site already shows per vertical)
const LOSS = [
  [/dental/i, 4800, "dental"],
  [/restaur|pizz|food/i, 3500, "restaurants"],
  [/medic|health|doctor/i, 5400, "medical"],
  [/law|legal|advocacia|abogado/i, 8200, "law"],
  [/real ?estate|imó|inmobil/i, 9200, "realestate"],
  [/plumb|hvac|encana|plomer/i, 7600, "plumbing"],
  [/auto|car|dealer/i, 11000, "auto"],
  [/gym|fitness|academia|gimnasio/i, 4200, "gym"],
  [/e-?commerce|shop|loja/i, 6100, "ecommerce"],
  [/salon|salão|spa|beauty/i, 3800, "salon"],
  [/clean|limpeza|limpieza/i, 5200, "cleaning"],
  [/account|contab/i, 6800, "accountants"],
  [/contract|construc|home service|serviços/i, 8400, "contractors"],
  [/vet/i, 5600, "veterinary"],
  [/clinic|clínica/i, 4800, "clinic"],
];
const DEFAULT_LOSS = 4500; // cross-vertical average when the industry is unknown

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // Same guard pattern as /api/lead: our own site only + per-IP brake (fail-open — this is
    // a courtesy email, not a costly call, so a KV blip must never block it).
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "roi", 5)) return json({ error: "too many requests" }, 429);
    const body = await request.json();
    const s = (v, n = 160) => (v == null ? "" : v.toString().slice(0, n));
    const name = s(body.name, 120);
    const email = s(body.email, 160).trim();
    const business = s(body.business, 160);
    const industry = s(body.industry, 80);
    const lang = ["pt", "es"].includes(s(body.lang, 5)) ? s(body.lang, 5) : "en";

    // No email → nothing to send. Silent ok keeps the front-end fire-and-forget simple.
    if (!email || !/.+@.+\..+/.test(email)) return json({ ok: true, sent: false });

    const hay = `${industry} ${business}`;
    const hit = LOSS.find(([re]) => re.test(hay));
    const loseMonthly = hit ? hit[1] : DEFAULT_LOSS;
    const vertical = industry || (hit ? hit[2] : "");

    if (!env.RESEND_API_KEY) return json({ ok: true, sent: false });
    // Contact instrument, same as lead.js: human replyable FROM + monitored Reply-To.
    const FROM = env.EMAIL_FROM_CONTACT || "Gui · Guileo <gui@guileoai.com>";
    const REPLY_TO = env.EMAIL_REPLY_TO || "smart@guileoai.com";
    const mail = roiReportEmail({ name: name || "there", business, vertical, loseMonthly, lang });
    let sent = false;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [email], subject: mail.subject, html: mail.html }),
      });
      sent = r.ok;
    } catch { /* best-effort — never fail the demo flow */ }
    return json({ ok: true, sent, loseMonthly });
  } catch {
    return json({ error: "bad request" }, 400);
  }
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
