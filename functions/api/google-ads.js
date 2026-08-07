// Cloudflare Pages Function — POST /api/google-ads  (GOOGLE ADS · DONE-FOR-YOU)
// ─────────────────────────────────────────────────────────────────────────────
// DECISÃO (Luis): NÃO é integração com a Google Ads API (complexa demais). É um
// PEDIDO DE SERVIÇO. O cliente (ou a Gui, no lugar dele) pede "quero anúncios no
// Google" → capturamos orçamento/objetivo/público/região em ads_requests → alertamos
// o TIME Guileo (owner email) que CRIA e GERENCIA as campanhas MANUALMENTE.
// HONESTIDADE ABSOLUTA: em nenhum momento fingimos que um anúncio está rodando — o
// status reflete o trabalho humano real do time. "Gestão feita pela equipe Guileo."
//
// TENANT (cockpit / Gui) — gated por get_client_data(email, key), sem fallback de owner:
//   POST { email, token, action:"request", budget, goal, area, notes } -> { ok, request }
//   POST { email, token, action:"status" }                             -> { ok, requests:[...] }
// ADMIN (/admin) — gated por blitz_stats(ADMIN_TOKEN):
//   POST { token, action:"list", status? }                             -> { ok, requests:[...] }
//   POST { token, action:"set_status", email, id, status }             -> { ok, request }
//
// SQL: db/ads_requests.sql. Até ser colado, todo caminho degrada com uma nota honesta
// em vez de 500. Requer db/ads_requests.sql em Supabase (ynihodbknhjirkdogxby).
import { json } from "../lib/guard.js";
import { ownerAlertEmail } from "../lib/emailTemplates.js";
import { svcRpc } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// dollars-ish → cents (accepts "1,500", "$1500/mo", 1500, or budget_cents directly)
function toCents(b) {
  if (b.budget_cents != null && Number.isFinite(Number(b.budget_cents))) {
    return Math.max(0, Math.min(Math.round(Number(b.budget_cents)), 100000000));
  }
  const raw = (b.budget != null ? String(b.budget) : "").replace(/[^0-9.]/g, "");
  const dollars = parseFloat(raw);
  if (!Number.isFinite(dollars) || dollars <= 0) return 0;
  return Math.max(0, Math.min(Math.round(dollars * 100), 100000000));
}

const uuidOk = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "request").toString();
    const token = (b.token || b.key || "").toString().trim();

    // ── ADMIN ACTIONS (the Guileo team's queue in /admin) ─────────────────────
    // Gate FIRST via blitz_stats(ADMIN_TOKEN) — an unauthenticated probe always 401s.
    if (action === "list" || action === "set_status") {
      const vr = await rpc("blitz_stats", { p_token: token, p_email: "" });
      if (!vr.ok) return json({ error: "unauthorized" }, 401);
      const ING = env.INGEST_SECRET || "";

      if (action === "list") {
        const status = (b.status || "").toString().trim().toLowerCase() || null;
        const r = await rpc("ads_request_list", { p_secret: ING, p_status: status });
        if (!r.ok) return json({ ok: true, ready: false, requests: [], note: "Paste db/ads_requests.sql in Supabase to activate the ads queue." });
        const rows = (await r.json().catch(() => [])) || [];
        return json({ ok: true, ready: true, count: rows.length, requests: rows });
      }

      // set_status — the team marks the REAL state of the manual work.
      const email = (b.email || "").toString().trim().toLowerCase();
      const id = (b.id || "").toString().trim();
      const status = (b.status || "").toString().trim();
      if (!email.includes("@") || !uuidOk(id) || !status) return json({ error: "email + id + status required" }, 400);
      const r = await rpc("ads_request_set_status", { p_secret: ING, p_email: email, p_id: id, p_status: status });
      if (!r.ok) return json({ error: "update failed (paste db/ads_requests.sql)" }, 502);
      const res = await r.json().catch(() => null);
      if (!res || res.ok !== true) return json({ error: "not found" }, 404);
      return json({ ok: true, request: res });
    }

    // ── TENANT ACTIONS (request / status) ─────────────────────────────────────
    // PER-TENANT GATE — bind the cockpit email to its connection key. No OWNER fallback.
    const email = (b.email || "").toString().trim().toLowerCase();
    if (!email.includes("@") || !token) return json({ error: "unauthorized" }, 401);
    const gd = await rpc("get_client_data", { p_email: email, p_key: token });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);
    const ING = env.INGEST_SECRET || "";
    const biz = (gdj.business || gdj.client_business || "").toString();

    if (action === "status") {
      const r = await rpc("ads_request_status", { p_secret: ING, p_email: email });
      if (!r.ok) return json({ ok: true, ready: false, requests: [], note: "Paste db/ads_requests.sql in Supabase to activate Google Ads requests." });
      const rows = (await r.json().catch(() => [])) || [];
      return json({ ok: true, ready: true, count: rows.length, requests: rows, managed: "Campaigns are built and managed by the Guileo team." });
    }

    if (action === "request") {
      const budgetCents = toCents(b);
      const goal = (b.goal || "").toString().slice(0, 200);
      const area = (b.area || "").toString().slice(0, 200);
      const notes = (b.notes || "").toString().slice(0, 2000);
      const cr = await rpc("ads_request_create", {
        p_secret: ING, p_email: email,
        p_budget_cents: budgetCents, p_goal: goal, p_area: area, p_notes: notes,
      });
      if (!cr.ok) return json({ ok: false, ready: false, note: "Paste db/ads_requests.sql in Supabase to activate Google Ads requests." }, 200);
      const req = await cr.json().catch(() => null);
      if (!req || !req.id) return json({ error: "request failed" }, 502);

      // Alert the Guileo team (owner email) that a client wants ads built — HONEST:
      // it says a client REQUESTED ads (manual service), never that anything is running.
      try {
        if (env.RESEND_API_KEY) {
          const owner = (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim();
          const budgetLabel = budgetCents ? `$${(budgetCents / 100).toLocaleString("en-US")}/mo` : "(not set)";
          const otpl = ownerAlertEmail({
            kind: "lead",
            customer: email,
            business: biz || email,
            details: `GOOGLE ADS REQUEST — client wants Google Ads built & managed by the Guileo team (manual, no API). Goal: ${goal || "—"} · Audience/area: ${area || "—"}${notes ? ` · Notes: ${notes}` : ""}. Set up in Google Ads and mark it 'building' → 'active' in /admin (nothing is running yet).`,
            amount: budgetLabel,
            lang: "en",
          });
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [owner], subject: `🎯 Google Ads request · ${biz || email}`, html: otpl.html }),
          });
        }
      } catch { /* owner alert is best-effort — never block the request */ }

      // Best-effort: log it in the tenant's own live feed (unified inbox) so the client
      // sees "Ads request submitted — team is building it". Never faked as active.
      try {
        await svcRpc(env, "ingest_client_event", {
          p_secret: ING, p_email: email,
          p_type: "message", p_channel: "Portal",
          p_summary: `Google Ads requested (${budgetCents ? `$${(budgetCents / 100).toLocaleString("en-US")}/mo` : "budget TBD"}) — the Guileo team is building your campaign.`.slice(0, 300),
          p_amount: 0,
          p_payload: { kind: "ads-request", request_id: String(req.id).slice(0, 60), status: req.status },
        });
      } catch { /* additive */ }

      return json({
        ok: true,
        request: req,
        managed: "Campaigns are created and managed by the Guileo team — nothing runs until we build it.",
        status: req.duplicate ? "already-requested" : "requested",
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
