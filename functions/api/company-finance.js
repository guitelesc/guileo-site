// Cloudflare Pages Function — POST /api/company-finance
// ADMIN-ONLY. Guileo's OWN company ledger (expenses/investments/revenue), separate from cost_events
// (which is per-CLIENT COGS). Same admin gate as onboard-client (blitz_stats raises on a wrong token).
//   { action:"summary", token }           -> { ok, summary }
//   { action:"list", token }              -> { ok, rows }
//   { action:"add", token, department, kind, category, vendor, description, amount_cents, recurring, notes }
import { json, sameOrigin, rateLimited } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "company-finance", 40)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "summary").toString();
    const ING = env.INGEST_SECRET || "";
    // ADMIN gate — same RPC as onboard-client. Wrong token raises → non-200 → 401.
    const gate = await rpc("blitz_stats", { p_token: (b.token || "").toString(), p_email: "" });
    if (!gate.ok) return json({ error: "unauthorized" }, 401);

    if (action === "summary") {
      const r = await rpc("company_ledger_summary", { p_secret: ING });
      if (!r.ok) return json({ error: "ledger unavailable" }, 500);
      return json({ ok: true, summary: await r.json().catch(() => null) });
    }
    if (action === "list") {
      const r = await rpc("company_ledger_list", { p_secret: ING });
      if (!r.ok) return json({ error: "ledger unavailable" }, 500);
      const rows = await r.json().catch(() => []);
      return json({ ok: true, rows: Array.isArray(rows) ? rows : [] });
    }
    if (action === "add") {
      const desc = (b.description || "").toString().trim();
      if (!desc) return json({ error: "description required" }, 400);
      const dollars = Number(b.amount || 0);
      const cents = Number.isFinite(b.amount_cents) ? Math.round(Number(b.amount_cents)) : Math.round(dollars * 100);
      const r = await rpc("company_ledger_add", {
        p_secret: ING, p_department: (b.department || "finance").toString(), p_kind: (b.kind || "expense").toString(),
        p_category: (b.category || "general").toString(), p_vendor: (b.vendor || "").toString().slice(0, 80),
        p_description: desc.slice(0, 240), p_amount_cents: Math.max(0, cents),
        p_recurring: (b.recurring || "").toString(), p_notes: (b.notes || "").toString().slice(0, 300),
      });
      if (!r.ok) return json({ error: "add failed" }, 500);
      return json({ ok: true, id: await r.json().catch(() => null) });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
