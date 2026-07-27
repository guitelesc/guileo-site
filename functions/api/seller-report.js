// Cloudflare Pages Function — GET/POST /api/seller-report?token=DIGEST_TOKEN
// Weekly SELLER report — the mirror of /api/client-report, but for each seller's WALLET.
// For every ACTIVE seller (db/seller_roster.sql → seller_list) that actually has skin in the
// game (carteira > 0 OR comissão > 0), it pulls their real numbers — wallet + paying + closed
// this month (seller_dashboard), commission ledger (seller_commission_ledger), balance due
// (seller_balance) — picks the 3 top-earning clients, adds a deterministic "play of the week"
// (src/data/sellerPlays.js, indexed by ISO week so the whole team gets the same move), and
// emails the branded sellerWeeklyEmail (functions/lib/emailTemplates.js) via Resend.
//
// ZERO SPAM: a seller with an empty wallet AND no commission is skipped. Cap 50/run.
// BEST-EFFORT per seller: one seller's failure never brings down the rest.
// PROOF: ?dryRun=1 → {would_send:[{email,paying,commission_cents}]} and sends NOTHING.
// TEST: ?email=X limits to one seller; ?to=Y sends to Y instead of the seller, but ONLY if Y is
// an owner inbox (so we can safely preview by emailing ourselves — mirrors client-report).
import { json, isOwnerEmail, safeEq } from "../lib/guard.js";
import { sellerWeeklyEmail } from "../lib/emailTemplates.js";
import { SELLER_PLAYS } from "../../src/data/sellerPlays.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// Awaited RPC — Cloudflare cancels fire-and-forget fetches, so every call is awaited (contract).
// Returns parsed JSON on 2xx, else null; the caller degrades honestly instead of throwing.
async function rpc(name, args) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// ISO-8601 week number — deterministic index into SELLER_PLAYS so the whole team sees the SAME
// "play of the week" all week and it rotates on its own next Monday (mirrors playOfTheDay's intent
// but weekly instead of daily, as the task requires).
function isoWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;        // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3);  // nearest Thursday
  const firstThursday = date.getTime();
  date.setUTCMonth(0, 1);
  if (date.getUTCDay() !== 4) date.setUTCMonth(0, 1 + ((4 - date.getUTCDay()) + 7) % 7);
  return 1 + Math.round((firstThursday - date.getTime()) / (7 * 24 * 3600 * 1000));
}

// Render a play object → a short plain string for the email (title + first concrete step).
// Falls back to en when the seller's lang copy is missing (micro-dict law); play is a STRING,
// esc() in the template handles escaping.
function playText(p, lang) {
  if (!p) return "";
  const l = p.title && p.title[lang] ? lang : "en";
  const title = (p.title && (p.title[l] || p.title.en)) || "";
  const steps = (p.how && (p.how[l] || p.how.en)) || [];
  return steps.length ? `${title} — ${steps[0]}` : title;
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (request.method !== "GET" && request.method !== "POST") return json({ error: "method" }, 405);
    const url = new URL(request.url);
    const tok = url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
    if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

    const dryRun = url.searchParams.get("dryRun") === "1";
    const onlyEmail = (url.searchParams.get("email") || "").trim().toLowerCase();
    const testTo = (url.searchParams.get("to") || "").trim();
    if (testTo && !isOwnerEmail(testTo, env)) return json({ error: "to must be an owner inbox" }, 401);
    // Sending needs a mailer + the INGEST secret for the RPCs; dryRun only needs the RPCs.
    const ING = env.INGEST_SECRET || "";
    if (!dryRun && !env.RESEND_API_KEY) return json({ error: "no mailer" }, 501);

    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    // Seller language: roster has no lang field → sellerWeeklyEmail supports pt/en only; the team
    // writes/reads PT, so pt is the honest default (env override for a future EN cohort).
    const lang = (env.SELLER_REPORT_LANG || "pt").toLowerCase() === "en" ? "en" : "pt";
    const play = playText(SELLER_PLAYS[isoWeek(new Date()) % SELLER_PLAYS.length], lang);

    let sellers = (await rpc("seller_list", { p_secret: ING })) || [];
    if (!Array.isArray(sellers)) sellers = [];
    sellers = sellers.filter((s) => s && s.active && s.email);
    if (onlyEmail) sellers = sellers.filter((s) => (s.email || "").toLowerCase() === onlyEmail);
    sellers = sellers.slice(0, 50);

    let reports = 0, skipped = 0;
    const wouldSend = [];

    for (const seller of sellers) {
      const email = (seller.email || "").toLowerCase();
      const ref = seller.ref || "";
      try {
        const [dash, ledger, balance] = await Promise.all([
          rpc("seller_dashboard", { p_secret: ING, p_seller_email: email, p_ref: ref }),
          rpc("seller_commission_ledger", { p_secret: ING, p_seller_email: email, p_ref: ref }),
          rpc("seller_balance", { p_secret: ING, p_seller_email: email, p_ref: ref }),
        ]);

        const wallet = Number(dash?.clients?.total || 0);
        const paying = Number(ledger?.totals?.clients || 0);
        const commission_cents = Number(balance?.commission_cents || 0);
        const due_cents = Number(balance?.due_cents || 0);
        const converted_month = Number(dash?.converted_month || 0);

        // ZERO SPAM: nothing in the wallet AND nothing earned → skip this seller entirely.
        if (wallet <= 0 && commission_cents <= 0) { skipped++; continue; }

        // top 3 earners — the ledger is already ordered by paid desc; carry business + commission.
        const rows = Array.isArray(ledger?.ledger) ? ledger.ledger : [];
        const topClients = rows.slice(0, 3).map((r) => ({
          business: r.business || "", client_email: r.client_email || "", commission: r.commission,
        }));

        if (dryRun) { wouldSend.push({ email, paying, commission_cents }); reports++; continue; }

        const sellerName = seller.name || email.split("@")[0];
        const { subject, html } = sellerWeeklyEmail({
          sellerName,
          stats: { wallet, paying, commission_cents, due_cents, converted_month },
          topClients, play, lang,
        });

        const sr = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: [testTo || email], subject, html }),
        });
        if (sr.ok) reports++; else skipped++;
      } catch { skipped++; }  // best-effort: one seller's failure never sinks the rest
    }

    if (dryRun) return json({ ok: true, dryRun: true, would_send: wouldSend, skipped });
    return json({ ok: true, reports, skipped });
  } catch (e) {
    return json({ error: String(e).slice(0, 120) }, 500);
  }
}
