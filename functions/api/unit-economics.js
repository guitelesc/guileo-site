// Cloudflare Pages Function — POST /api/unit-economics   (FUNDAÇÃO 5a)
// Unit economics por cliente E da plataforma: o que a Guileo PAGA (cost_events, provedores
// reais) vs o que RECEBE (client_events payment = planos + top-ups de crédito, mesma espinha
// que money_reconcile). Margem = receita − custo, por cliente e agregada.
//
//   POST { token }            -> visão plataforma: { platform, providers, partial, clients:[...] }
//   POST { token, email }     -> drill de 1 cliente: + client_business_revenue (revenue_month, ROI)
//
// GATE: admin — verifica o token contra o RPC token-gated blitz_stats (igual admin-blitz.js);
// probe não-autenticado sempre recebe 401. Só depois disso as RPCs INGEST-gated são chamadas
// com o segredo do servidor. NUNCA aceita OWNER_EMAIL fallback nem confia em input de tenant.
//
// HONESTIDADE: o custo só existe onde um ponto de custo REALMENTE grava (voz/LLM/SMS/fee). O
// campo `partial` fica true quando algum provedor esperado ainda não gravou nada na janela —
// aí a margem é um piso (custo subestimado), e o endpoint diz exatamente quais faltam. Nada é
// estimado às cegas: cliente sem custo registrado aparece com cost_cents=0 e partial no total.
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// todo provedor que a Guileo paga — a base do "parcial": se um destes não gravou, custo é piso.
const EXPECTED_PROVIDERS = ["elevenlabs", "anthropic", "twilio", "stripe"];

async function rpc(name, body) {
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const token = (b.token || "").toString();

    // AUTH FIRST — mesmo padrão de admin-blitz.js: valida o admin token antes de qualquer
    // leitura, para um probe não-autenticado sempre receber 401 (nunca confirma a forma).
    const vr = await rpc("blitz_stats", { p_token: token, p_email: "" });
    if (!vr) return json({ error: "unauthorized" }, 401);

    const secret = env.INGEST_SECRET || "glo_ing_7f3da9c2b4e8";
    const email = (b.email || "").toString().trim().toLowerCase();
    // janela: mês corrente (UTC), igual revenue.js/client-report.js → cockpit e conta batem.
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    // ── DRILL de 1 cliente ────────────────────────────────────────────────
    if (email.includes("@")) {
      const [cost, recAll, rev] = await Promise.all([
        rpc("cost_summary", { p_secret: secret, p_email: email, p_since: since }),
        rpc("guileo_receipts_all", { p_secret: secret, p_since: since }),
        rpc("revenue_month", { p_secret: secret, p_email: email, p_since: since }), // negócio do cliente (ROI/contexto)
      ]);
      // cost_summary ausente = SQL não colado ainda → honesto not-ready.
      if (!cost || cost.ready !== true) return json({ ok: true, ready: false, note: "cost_ledger.sql not applied yet" });

      const cost_cents = Number(cost.total_cents) || 0;
      const by_provider = cost.by_provider || {};
      // receita da Guileo p/ este cliente = seus recebimentos Stripe (plano + top-ups).
      let receipts_cents = 0, receipts_ready = false;
      if (recAll && recAll.ready === true) {
        receipts_ready = true;
        const hit = (recAll.clients || []).find((c) => (c.email || "").toLowerCase() === email);
        receipts_cents = hit ? (Number(hit.cents) || 0) : 0;
      }
      const client_business_revenue_cents =
        rev && typeof rev.total_cents === "number" ? rev.total_cents : null;

      const wired = Object.keys(by_provider);
      const missing = EXPECTED_PROVIDERS.filter((p) => !wired.includes(p));
      const margin_cents = receipts_ready ? receipts_cents - cost_cents : null;

      return json({
        ok: true, ready: true, scope: "client", email, since,
        guileo_cost_cents: cost_cents,
        cost_by_provider: by_provider,
        guileo_receipts_cents: receipts_ready ? receipts_cents : null,
        margin_cents,                       // receita Guileo − custo Guileo (null se receita não disponível)
        client_business_revenue_cents,      // revenue_month: receita do NEGÓCIO do cliente (ROI), NÃO da Guileo
        partial: missing.length > 0 || !receipts_ready,
        missing_cost_providers: missing,    // provedores esperados sem custo gravado → margem é piso
      });
    }

    // ── VISÃO plataforma (todos os clientes) ──────────────────────────────
    const [costAll, recAll] = await Promise.all([
      rpc("cost_summary_all", { p_secret: secret, p_since: since }),
      rpc("guileo_receipts_all", { p_secret: secret, p_since: since }),
    ]);
    if (!costAll || costAll.ready !== true) return json({ ok: true, ready: false, note: "cost_ledger.sql not applied yet" });

    const receiptsByEmail = new Map();
    let platform_receipts_cents = 0, receipts_ready = false;
    if (recAll && recAll.ready === true) {
      receipts_ready = true;
      platform_receipts_cents = Number(recAll.total_cents) || 0;
      for (const c of (recAll.clients || [])) receiptsByEmail.set((c.email || "").toLowerCase(), Number(c.cents) || 0);
    }

    const wired = Array.isArray(costAll.providers_wired) ? costAll.providers_wired : [];
    const missing = EXPECTED_PROVIDERS.filter((p) => !wired.includes(p));
    const platform_cost_cents = Number(costAll.platform?.total_cents) || 0;

    // por cliente: junta custo (costAll.clients) + receita (receiptsByEmail) → margem.
    const seen = new Set();
    const clients = [];
    for (const c of (costAll.clients || [])) {
      const em = (c.email || "").toLowerCase();
      seen.add(em);
      const cost_cents = Number(c.cost_cents) || 0;
      const receipts = receiptsByEmail.get(em);
      clients.push({
        email: em, guileo_cost_cents: cost_cents, cost_by_provider: c.by_provider || {},
        guileo_receipts_cents: receipts_ready ? (receipts || 0) : null,
        margin_cents: receipts_ready ? (receipts || 0) - cost_cents : null,
      });
    }
    // clientes que a Guileo RECEBEU mas ainda sem custo registrado — honestidade: aparecem c/ custo 0.
    for (const [em, cents] of receiptsByEmail) {
      if (seen.has(em)) continue;
      clients.push({ email: em, guileo_cost_cents: 0, cost_by_provider: {},
        guileo_receipts_cents: cents, margin_cents: cents });
    }
    clients.sort((a, b) => (b.margin_cents ?? -1e15) - (a.margin_cents ?? -1e15));

    return json({
      ok: true, ready: true, scope: "platform", since,
      platform: {
        guileo_cost_cents: platform_cost_cents,
        cost_by_provider: costAll.platform?.by_provider || {},
        guileo_receipts_cents: receipts_ready ? platform_receipts_cents : null,
        margin_cents: receipts_ready ? platform_receipts_cents - platform_cost_cents : null,
      },
      providers_wired: wired,
      missing_cost_providers: missing,
      partial: missing.length > 0 || !receipts_ready,  // custo é PISO enquanto algum ponto não grava
      clients,
    });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
