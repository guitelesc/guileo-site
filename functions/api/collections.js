// Cloudflare Pages Function — POST /api/collections  (COMPANY OS Finance: "A receber")
// Gui collects overdue invoices POLITELY: one friendly payment reminder per overdue invoice,
// by WhatsApp-first text (falls back to SMS). If the invoice carries a pay_link (minted by
// close&collect), the reminder includes it; otherwise it's a warm "reply here" nudge.
// Per-tenant gated exactly like reactivate.js (get_client_data binds email↔key; NO admin
// fallback). Dedup lives in SQL: finance_mark_nudged is an atomic 72h claim per invoice.
//   POST { token, email, action:"list" }                    -> { ok, ready, count, invoices }
//   POST { token, email, action:"nudge", ids?, dryRun?, lang? } -> { ok, dryRun, pulled, sent, skipped, results }
//
// CRON MODE (autonomous weekly sweep, hit by the guileo-digest-cron Worker):
//   GET/POST /api/collections?token=DIGEST_TOKEN&sweep=1
//     -> { ok, sweep, ready, configured, clients, nudged, claimed_dupe, skipped, capped }
//   Iterates ONLY tenants who opted in (client_integrations provider='collections_auto',
//   db/collections_optin.sql — default OFF), runs the same nudge logic with dryRun=false,
//   per-client cap 10 / global cap 50, and the same atomic 72h SQL dedup. The per-tenant
//   POST above keeps its full email↔key gate — the sweep is a separate, DIGEST-gated door.
import { json, safeEq } from "../lib/guard.js";
import { sendText } from "../lib/twilio.js";
import { emitFailure } from "../lib/failure.js";
import { sbKey } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (env, fn, args = {}) => fetch(`${SB}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
}).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// Every real nudge lands in the cockpit feed (same ingest_client_event pattern as reactivate.js).
const ingest = (env, email, summary, phone) => rpc(env, "ingest_client_event", {
  p_email: email, p_type: "collection", p_channel: "Phone", p_summary: summary.slice(0, 300), p_amount: 0, p_payload: { phone, nudge: true },
});

const fmtMoney = (cents) => `$${(Math.round(cents || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The reminder itself — a Four-Seasons-polite nudge, never a threat. lang ∈ pt | es | en.
// Keep every variant SMS-safe (well under 300 chars even with a pay link).
function reminderMsg(inv, lang) {
  const num = inv.number ? ` ${inv.number}` : "";
  const val = fmtMoney(inv.amount_cents);
  const dias = Math.max(1, inv.days_late || 1);
  const link = (inv.pay_link || "").toString().trim();
  if (lang === "pt") {
    const nome = inv.contact_name || "tudo bem";
    return (`Oi ${nome}! 🌱 Passando com carinho pra lembrar: a fatura${num} de ${val} venceu há ${dias} dia${dias > 1 ? "s" : ""}. ` +
      (link ? `Se quiser, dá pra pagar por aqui: ${link} ` : "É só responder aqui que a gente resolve juntinho. ") +
      "Qualquer dúvida, estou por aqui. Obrigado! 💚").trim();
  }
  if (lang === "es") {
    const nome = inv.contact_name ? ` ${inv.contact_name}` : "";
    return (`¡Hola${nome}! 🌱 Un recordatorio amable: la factura${num} de ${val} venció hace ${dias} día${dias > 1 ? "s" : ""}. ` +
      (link ? `Si gustas, puedes pagarla aquí: ${link} ` : "Solo responde aquí y lo resolvemos juntos. ") +
      "Cualquier duda, aquí estoy. ¡Gracias! 💚").trim();
  }
  const nome = inv.contact_name || "there";
  return (`Hi ${nome}! 🌱 Just a friendly reminder: invoice${num} for ${val} was due ${dias} day${dias > 1 ? "s" : ""} ago. ` +
    (link ? `You can pay it right here: ${link} ` : "Just reply here and we'll sort it out together. ") +
    "Thank you so much! 💚").trim();
}

// Normalize any profile/body language value to the three supported reminder languages.
const langNorm = (v) => { const l = (v || "").toString().toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };

// ONE overdue book → polite nudges. Shared by the per-tenant button AND the cron sweep so the
// two paths can never drift. Claims the atomic 72h dedup (finance_mark_nudged) BEFORE each send.
// budget (optional) = shared counter object { left } so the sweep can cap globally across tenants.
async function nudgeInvoices(env, email, rows, { dryRun = false, lang = "en", onlyIds = null, cap = 25, budget = null } = {}) {
  const out = { sent: 0, skipped: 0, claimed_dupe: 0, results: [] };
  let sent = 0;
  for (const inv of rows) {
    if (sent >= cap) break;
    if (budget && budget.left <= 0) break;
    if (onlyIds && !onlyIds.includes(String(inv.id))) continue;
    const e164 = (inv.phone || "").toString().replace(/[^0-9+]/g, "");
    const recent = inv.nudged_at && (Date.now() - new Date(inv.nudged_at).getTime()) < 72 * 3600 * 1000;
    const why = !/^\+?[1-9]\d{7,14}$/.test(e164) ? "no phone" : inv.consent_sms === false ? "no consent" : recent ? "nudged <72h ago" : "";
    if (why) { out.skipped++; if (dryRun) out.results.push({ id: inv.id, to: inv.contact_name || "—", skip: why }); continue; }
    const msg = reminderMsg(inv, lang);

    if (dryRun) {
      sent++; out.sent++;
      out.results.push({ id: inv.id, to: inv.contact_name || `${e164.slice(0, 4)}…${e164.slice(-2)}`, amount_cents: inv.amount_cents, msg });
      continue;
    }

    // ATOMIC dedup claim in SQL — false means another run already reminded them; skip politely.
    const claimed = await rpc(env, "finance_mark_nudged", { p_email: email, p_id: inv.id });
    if (claimed !== true) { out.claimed_dupe++; continue; }
    const r = await sendText(env, e164, msg, { channel: "whatsapp" }); // WhatsApp-first, SMS fallback
    if (r && r.sent) {
      sent++; out.sent++;
      if (budget) budget.left--;
      out.results.push({ id: inv.id, to: inv.contact_name || `${e164.slice(0, 4)}…${e164.slice(-2)}`, amount_cents: inv.amount_cents, sent: true });
      await ingest(env, email, `💳 Payment reminder → ${inv.contact_name || e164} · ${fmtMoney(inv.amount_cents)}${inv.number ? ` (${inv.number})` : ""}`, e164);
    } else {
      out.skipped++;
      // The 72h claim is already BURNED but the text never left — without an alert this invoice
      // silently goes un-nudged for 3 days. Surface it in /admin; never blocks the loop.
      await emitFailure(env, "collection_nudge_failed", email,
        `claimed invoice ${inv.id} (${fmtMoney(inv.amount_cents)}) but the reminder text failed to send — nudge lost for 72h`,
        { invoice_id: inv.id, reason: String((r && (r.reason || r.error)) || "send failed").slice(0, 120) });
    }
  }
  return out;
}

// ── CRON SWEEP — ?token=DIGEST_TOKEN&sweep=1 — Gui collects on its own, weekly ──
// OPT-IN ONLY: collections_auto_list returns just the tenants who flipped the flag on
// (db/collections_optin.sql). Until that SQL is pasted the sweep is an honest no-op.
async function runSweep(env) {
  const configured = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
  const out = { ok: true, sweep: true, ready: true, configured, clients: 0, nudged: 0, claimed_dupe: 0, skipped: 0, capped: false };
  const optins = await rpc(env, "collections_auto_list", {});
  if (!Array.isArray(optins)) {
    return json({ ...out, ready: false, note: "Paste db/collections_optin.sql to activate the auto-collections sweep (opt-in per tenant)." });
  }
  if (!configured) return json({ ...out, note: "Twilio not configured — nothing sent, nothing claimed." });
  const GLOBAL_CAP = 50, PER_CLIENT_CAP = 10;
  const budget = { left: GLOBAL_CAP };
  for (const c of optins) {
    if (budget.left <= 0) { out.capped = true; break; }
    const email = ((c && c.client_email) || "").toString().trim().toLowerCase();
    if (!email.includes("@")) continue;
    // The tenant's language comes from their profile — PT owners get PT reminders, ES get ES.
    const prof = (await rpc(env, "get_client_profile", { p_email: email })) || {};
    const rows = await rpc(env, "finance_overdue_list", { p_email: email, p_limit: 200 });
    if (!Array.isArray(rows) || rows.length === 0) continue;
    out.clients++;
    const r = await nudgeInvoices(env, email, rows, {
      dryRun: false, lang: langNorm(prof.lang), cap: PER_CLIENT_CAP, budget,
    });
    out.nudged += r.sent; out.claimed_dupe += r.claimed_dupe; out.skipped += r.skipped;
  }
  return json(out);
}

// The DIGEST gate — identical to /api/automations: query token (or header) vs env.DIGEST_TOKEN.
function sweepAuth(request, env) {
  const url = new URL(request.url);
  if (url.searchParams.get("sweep") !== "1") return null; // not a sweep call
  const tok = url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);
  return "ok";
}

// Cron workers often GET — the sweep is the ONLY thing GET serves (tenant reads stay POST-gated).
export async function onRequestGet(context) {
  const { request, env } = context;
  const gate = sweepAuth(request, env);
  if (gate === null) return json({ error: "method" }, 405);
  if (gate !== "ok") return gate;
  try { return await runSweep(env); } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // ?sweep=1 → cron mode. It NEVER falls through to the tenant path (and vice-versa): a bad
    // sweep token is a hard 401, and the per-tenant email↔key gate below stays exactly as it was.
    const gate = sweepAuth(request, env);
    if (gate !== null) return gate === "ok" ? await runSweep(env) : gate;

    const b = await request.json().catch(() => ({}));
    // PER-TENANT GATE — bind the cockpit email to its connection key (get_client_data rejects a
    // mismatch). This endpoint fires REAL payment reminders, so a token must only ever nudge ITS
    // OWN tenant's customers — never an arbitrary email. No OWNER_EMAIL fallback.
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    // ── action: auto_get / auto_set — the per-tenant AUTO-COLLECTIONS opt-in flag ──
    // Same flag the weekly cron sweep honors (db/collections_optin.sql; the SQL itself is
    // INGEST-gated — rpc() sends env.INGEST_SECRET). Until that SQL is pasted the RPCs 404
    // and rpc() yields null, so we answer ready:false gracefully instead of erroring. These
    // live BEHIND the exact same get_client_data gate as list/nudge — nothing was loosened.
    if (b.action === "auto_get") {
      const on = await rpc(env, "collections_auto_enabled", { p_email: email });
      if (typeof on !== "boolean") return json({ ok: true, ready: false, enabled: false, note: "Paste db/collections_optin.sql to activate the auto-collections opt-in." });
      return json({ ok: true, ready: true, enabled: on });
    }
    if (b.action === "auto_set") {
      const want = b.enabled === true || b.enabled === "1";
      const r = await rpc(env, "collections_set_auto", { p_email: email, p_on: want });
      if (r !== true) return json({ ok: true, ready: false, enabled: false, note: "Paste db/collections_optin.sql to activate the auto-collections opt-in." });
      return json({ ok: true, ready: true, enabled: want }); // echo the new state
    }

    // Pull the tenant's overdue book (SQL flags days_late + last nudge per invoice).
    // ── action: mark_paid — the "✓ Marcar paga" button in the cockpit ──
    // Baixa manual de UMA fatura vencida do PRÓPRIO tenant. Usa SEMPRE o email DO GATE
    // (get_client_data acima) — nunca um email solto do body — para que um token só possa
    // dar baixa nas faturas do seu próprio negócio. finance_mark_paid só transiciona
    // sent/overdue → paid e é escopada por client_email no SQL (dupla defesa).
    if (b.action === "mark_paid") {
      const id = (b.id || "").toString().trim();
      // valida UUID v4-ish antes de tocar o banco (evita chamada inútil / injeção de tipo)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return json({ error: "bad id" }, 400);
      }
      const paid = await rpc(env, "finance_mark_paid", { p_email: email, p_id: id });
      // false = fatura não encontrada, de outro tenant, ou já paga — honesto, sem inventar sucesso.
      return json({ ok: true, paid: paid === true });
    }


    const rows = (await rpc(env, "finance_overdue_list", { p_email: email, p_limit: 200 }));
    if (!Array.isArray(rows)) return json({ ok: true, ready: false, note: "Paste db/receivables.sql to activate collections.", count: 0, invoices: [] });

    // ── action: list — the "A receber" board ──
    if (b.action === "list" || !b.action) {
      return json({ ok: true, ready: true, count: rows.length, invoices: rows });
    }

    // ── action: nudge — send (or preview with dryRun) one polite reminder per overdue invoice ──
    if (b.action === "nudge") {
      const dryRun = b.dryRun === true || b.dryRun === "1"; // preview WHO + WHAT, send NOTHING
      const lang = langNorm(b.lang); // pt / es / en (default)
      const onlyIds = Array.isArray(b.ids) ? b.ids.map(String) : null; // optional subset
      // CAP 25 — hard ceiling per run; collections must never feel like a barrage.
      const r = await nudgeInvoices(env, email, rows, { dryRun, lang, onlyIds, cap: 25 });
      return json({ ok: true, dryRun, pulled: rows.length, sent: r.sent, skipped: r.skipped, claimed_dupe: r.claimed_dupe, results: r.results });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
