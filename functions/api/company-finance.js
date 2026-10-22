// Cloudflare Pages Function — POST /api/company-finance
// ADMIN-ONLY. Guileo's OWN company ledger (expenses/investments/revenue), separate from cost_events
// (which is per-CLIENT COGS). Same admin gate as onboard-client (blitz_stats raises on a wrong token).
//   { action:"summary", token }           -> { ok, summary }
//   { action:"list", token }              -> { ok, rows }
//   { action:"add", token, department, kind, category, vendor, description, amount_cents, recurring, notes }
//   { action:"sync_revenue", token }      -> espelha as invoices PAGAS do Stripe (30d) como revenue,
//                                            idempotente pelo id da invoice. Ver db/company_ledger_stripe.sql
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
    // ── 🔄 SINCRONIZAR RECEITA DO STRIPE (últimos 30d) ──────────────────────────────────────
    // POR QUE: este razão é 100% digitado à mão. Despesa a gente lembra de lançar; receita, não —
    // então o cartão "Receita" mostrava menos que a verdade ao lado de despesas completas, e razão
    // com um lado completo e o outro pela metade parece prejuízo.
    // COMO: PUXA as invoices PAGAS da API do Stripe e espelha no company_ledger como `revenue`.
    // ⚠️ NÃO toca no stripe-webhook (outro fluxo, outro dono) e NÃO grava client_events
    //    type='payment' — isso entraria na receita_30d do Painel de Comando e a mesma venda
    //    apareceria duas vezes na MESMA página.
    // IDEMPOTENTE pelo id da invoice (in_xxx) via company_ledger_add_ext + índice único parcial:
    // clicar 10× lança uma vez só. Sem a chave do Stripe, diz isso — nunca "0 sincronizados".
    if (action === "sync_revenue") {
      if (!env.STRIPE_SECRET_KEY) return json({ ok: false, motivo: "conecte a chave do Stripe (STRIPE_SECRET_KEY) — sem ela não há o que sincronizar" }, 400);
      const desde = Math.floor(Date.now() / 1000) - 30 * 86400;
      let sr;
      try {
        sr = await fetch(`https://api.stripe.com/v1/invoices?status=paid&limit=100&created[gte]=${desde}&expand[]=data.customer`, {
          headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
        });
      } catch (e) { return json({ ok: false, motivo: `não consegui falar com o Stripe: ${String(e).slice(0, 120)}` }, 503); }
      const sd = await sr.json().catch(() => ({}));
      // PORTÃO DE STATUS ANTES DO FALLBACK: um 401/429 viraria `data: []` → "0 invoices pagas",
      // que é o oposto de "não consegui perguntar".
      if (!sr.ok) return json({ ok: false, motivo: `o Stripe recusou: ${(sd.error && sd.error.message) || `HTTP ${sr.status}`}` }, 503);

      const invoices = Array.isArray(sd.data) ? sd.data : [];
      let novos = 0, repetidos = 0, falhas = 0;
      for (const inv of invoices) {
        const cents = Math.round(Number(inv.amount_paid || 0));
        if (!Number.isFinite(cents) || cents <= 0) continue;
        const cli = inv.customer && typeof inv.customer === "object" ? inv.customer : {};
        const quem = cli.email || cli.name || (inv.customer_email || "") || "cliente";
        const r = await rpc("company_ledger_add_ext", {
          p_secret: ING, p_ext_ref: `stripe:${inv.id}`, p_department: "finance", p_kind: "revenue",
          p_category: "assinatura", p_vendor: "Stripe",
          p_description: `Assinatura paga — ${quem}`.slice(0, 240),
          p_amount_cents: cents,
          p_entry_date: new Date(Number(inv.created || Math.floor(Date.now() / 1000)) * 1000).toISOString().slice(0, 10),
          p_notes: (inv.number || "").toString().slice(0, 60),
        });
        // Lemos a RESPOSTA da função, não o status do fetch — 200 com {ok:false} é recusa.
        const d = r.ok ? await r.json().catch(() => null) : null;
        if (!d || d.ok !== true) { falhas++; continue; }
        if (d.criado) novos++; else repetidos++;
      }
      return json({
        ok: falhas === 0, lidas: invoices.length, novos, repetidos, falhas,
        motivo: falhas ? `${falhas} lançamento(s) recusado(s) pelo banco — db/company_ledger_stripe.sql aplicado?` : "",
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
