// Cloudflare Pages Function — POST /api/support
// Gui Suporte (client) + BROTO (admin). Instant resolution comes from the client-side scenario
// library (src/data/supportKB.js); this endpoint persists tickets, lists the queue, manages
// inventory, and provides the AI FALLBACK (Claude) for the rare question the library doesn't cover.
import { factsBlock } from "../lib/productFacts.js";
import { guardSystemPrompt } from "../lib/guiConstitution.js";
import { json, rateLimited } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

// The CURRENT feature map Gui Support answers from — kept in sync with the cockpit so the AI never
// gives stale facts. Grouped so both the "support" and "trainer" contexts share one source of truth.
const FEATURE_FACTS = `GUILEO COCKPIT — what the owner actually has (answer from THIS, never invent a feature):
• Your AI: a 24/7 AI receptionist (Gui) answers every call, replies on WhatsApp/SMS/web-chat, books appointments, quotes your real prices, and closes & collects (pay-links/deposits). "Train your AI" (brain) + "Cérebro do negócio" (Knowledge Base — your own Q&A) shape what Gui says.
• Operations: live Schedule, Risk Radar (ranks upcoming appointments by no-show risk so you over-confirm the risky ones), Storm Mode (1-tap close+notify+reopen for a hurricane/emergency), LiveOrders/Kitchen where relevant.
• Customers: CRM 360 (every lead+contact with a full timeline), Leads do dia, Marketplace leads (Yelp/Angi/Thumbtack → Gui calls in ~60s).
• Grow revenue: Finance (real revenue from the ledger), Marketing, Datas & Aniversários (birthday/commemorative campaigns), Cupons & Campanhas (your own branded coupons), Inteligência (LTV, lead sources, forecast, abandoned bookings), Captura (intake forms + photo-quote), packages/memberships/gift cards (Recurring). A weekly value report emails you the ROI every Monday.
• Referrals: refer another business → both sides get credit when they subscribe.
• Billing: plans + credit top-ups; your credit balance and the "connection code" that links this cockpit live in Settings; contracts/invoices in Documents.
• Channels honesty: voice, SMS, web-chat and email are LIVE; WhatsApp/Instagram/Google/Ads light up when their API is connected (shown with an amber badge until then).`;

// Model fallback chain (same discipline as pitch-ai.js/widget-chat.js): a transient failure on one
// model must NOT drop the owner to a naked error. Try each in order; auth/billing stops early.
// MODEL_CHAIN vem de ../lib/guiBrain.js — NÃO declare outra aqui (2026-08-12).
// Eram DEZ cópias idênticas da mesma lista de modelos, uma por arquivo. Idênticas HOJE: conferi as
// dez antes de mexer, e é exatamente por estarem iguais que a hora de unificar é agora — depois que
// uma diverge, alguém já foi atendido pelo modelo errado e ninguém sabe qual superfície foi.
// É o padrão que esta sessão inteira perseguiu: cópia sem vínculo com a fonte.
import { MODEL_CHAIN } from "../lib/guiBrain.js";

// AI answer — Gui answers a Guileo support/training question warmly + flags if it needs a human.
// context: "support" (default) or "trainer" (the in-cockpit Treinadora teaching the owner to use it).
export async function aiAnswer(env, question, lang, context = "support") {
  if (!env.ANTHROPIC_API_KEY || !question) return null;
  const langName = lang === "pt" ? "Brazilian Portuguese" : lang === "es" ? "LatAm Spanish" : lang === "hi" ? "Hindi" : "English";
  const persona = context === "trainer"
    ? `You are Gui, the friendly onboarding Trainer inside the Guileo cockpit. The owner is LEARNING to use the platform. Answer their "how do I…?" question concretely in ${langName}, first person as Gui, 2-4 warm sentences, and when useful name the EXACT tab/button to tap. Tie the answer to what they GAIN (more bookings, fewer no-shows, faster follow-up). Only set escalate:true if it's truly a billing/refund/account issue you can't teach.`
    : `You are Gui Support, the warm concierge AI for Guileo. Answer the owner's support question concretely in ${langName}, first person as Gui, 2-4 sentences, calm and helpful. If the request is a refund, cancellation, account deletion, legal/privacy request, or billing dispute, briefly help AND set escalate:true (a human teammate picks it up).`;
  const system = `${guardSystemPrompt(persona, { audience: "client" })}\n\n${FEATURE_FACTS}\n\n${factsBlock()}\n\nReply ONLY compact JSON: {"answer":"...","escalate":true|false}`;
  for (const model of MODEL_CHAIN) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 340, system, messages: [{ role: "user", content: question.slice(0, 1500) }] }),
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        const txt = d?.content?.[0]?.text || "";
        if (!txt) continue;
        const m = txt.match(/\{[\s\S]*\}/);
        return m ? JSON.parse(m[0]) : { answer: txt.slice(0, 600), escalate: false };
      }
      if (r.status === 401 || r.status === 402) break; // auth/billing won't improve with another model
    } catch { /* try next model */ }
  }
  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "support", 40)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "list").toString();
    const secret = env.SCHED_SECRET || "";

    // PER-TENANT GATE: get_client_data binds email↔connection-key (rejects a mismatch), so a token
    // can only ever touch its OWN tenant's tickets. No OWNER_EMAIL fallback. (BROTO's whole-queue
    // view is admin-gated separately via /api/broto.)
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    if (action === "ai") {
      const ctx = b.context === "trainer" ? "trainer" : "support";
      const ans = await aiAnswer(env, (b.question || "").toString(), (b.lang || "en").toString(), ctx);
      return json({ ok: true, ...(ans || { answer: null, escalate: true }) });
    }

    if (action === "create") {
      const r = await rpc("support_ticket_create", { p_secret: secret, p_email: email, p_subject: b.subject || null, p_category: b.category || "other", p_body: b.body || "", p_ai_handled: b.ai_handled === true, p_status: b.status || "open", p_kb_id: b.kb_id || null, p_priority: b.priority || "normal" });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/support.sql to activate support." });
      return json({ ok: true, ready: true, id: await r.json() });
    }
    if (action === "reply") {
      const r = await rpc("support_ticket_reply", { p_secret: secret, p_id: b.id, p_role: b.role || "gui", p_text: b.text || "" });
      return json({ ok: r.ok, replied: r.ok ? await r.json() : false });
    }
    if (action === "set") {
      const r = await rpc("support_ticket_set", { p_secret: secret, p_id: b.id, p_status: b.status || null, p_resolution: b.resolution || null, p_assigned: b.assigned || null });
      return json({ ok: r.ok, updated: r.ok ? await r.json() : false });
    }
    if (action === "inventory_list") {
      const r = await rpc("inventory_list", { p_secret: secret, p_limit: 800 });
      if (!r.ok) return json({ ok: true, ready: false, items: [] });
      return json({ ok: true, ready: true, items: (await r.json()) || [] });
    }
    if (action === "inventory_upsert") {
      const r = await rpc("inventory_upsert", { p_secret: secret, p_id: b.id || null, p_kind: b.kind || "number", p_label: b.label || "", p_status: b.status || "available", p_assigned: b.assigned || null, p_meta: b.meta || {} });
      return json({ ok: r.ok, id: r.ok ? await r.json() : null });
    }

    // default: list tickets — ALWAYS scoped to the caller's own email. The whole cross-tenant
    // queue is admin-only and served by /api/broto (admin-password gated). A client token must
    // never be able to read another tenant's tickets, so `all:true` is intentionally ignored here.
    const r = await svcRpc(env, "support_ticket_list", { p_secret: secret, p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 200, 1), 1000) });
    if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/support.sql to activate support.", tickets: [] });
    const tickets = (await r.json()) || [];
    return json({ ok: true, ready: true, count: tickets.length, tickets });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
