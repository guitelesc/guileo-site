// Cloudflare Pages Function — POST /api/timeline  (Company-OS · "Do fornecedor ao cliente")
// ═════════════════════════════════════════════════════════════════════════════
// ONE horizontal money-flow the owner reads left→right:
//   FORNECEDOR/CUSTO → OPERAÇÃO (Gui trabalha) → CLIENTE FECHA → LUCRO NA MÃO → RISCO DE RETORNO
// It assembles the client's OWN real data by REUSING already-gated RPCs — it invents nothing:
//   • custo    → cost_summary       (db/cost_ledger.sql)  — what it costs to run (voz/SMS/providers)
//   • operação → ops_board.stats    (db/operations.sql)   — jobs the agent handled (biz_appointments)
//   • fecha    → ops_board.done      "        "            — jobs closed/completed
//   • lucro    → revenue_month       (db/revenue_month.sql) — authoritative ledger; profit = receita − custo
//   • risco    → ops_board no_show+overdue — jobs that fell through; cents = estimated exposure (avg ticket × count)
//
// GATE: per-tenant, EXACTLY like /api/operations.js & /api/revenue.js — get_client_data(email,key) binds
// the cockpit email to its connection key (rejects a mismatch → 401) BEFORE any read. Only then do we call
// the INGEST-gated RPCs with the server-side INGEST_SECRET. Read-only (no mutations). Never 500 on missing
// data — each stage degrades honestly, and ready:false with a note when NO underlying SQL is installed.
//
//   POST { email, dataKey, from?, to?, lang? }      (lang = en|pt|es|hi; padrão: cadastro → en)
//     → { ok, ready, lang, window:{from,to}, stages:[{key,label,kind,count,amount_cents,note,detalhe_tecnico?}],
//         money:{ cost_cents, revenue_cents, profit_cents, risk_cents } }
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const ING = "";

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

const asObj = (d) => (Array.isArray(d) ? (d[0] || {}) : (d && typeof d === "object" ? d : {}));
const intOf = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.dataKey || b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);

    // PER-TENANT GATE — the same door operations.js / revenue.js use. Mismatch → 401 before any read.
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const secret = env.INGEST_SECRET || ING;
    const now = new Date();
    // Money window = current calendar month (UTC), matching revenue.js so the timeline and the ROI headline agree.
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const winFrom = (typeof b.from === "string" && b.from) ? b.from : monthStart;
    const winTo = (typeof b.to === "string" && b.to) ? b.to : now.toISOString();
    // ops_board captures the operational volume over the whole window (+2d ahead for upcoming jobs).
    const opsTo = new Date(now.getTime() + 2 * 864e5).toISOString();

    // Three independent gated reads in parallel — each may be absent; we degrade per-stage, never 500.
    const [costRes, opsRes, revRes, refRes] = await Promise.all([
      rpc("cost_summary", { p_secret: secret, p_email: email, p_since: winFrom }),
      rpc("ops_board", { p_secret: secret, p_email: email, p_from: winFrom, p_to: opsTo }),
      rpc("revenue_month", { p_secret: secret, p_email: email, p_since: winFrom }),
      rpc("returns_breakdown_window", { p_secret: secret, p_email: email, p_since: winFrom }),
    ]);

    // ── CUSTO (fornecedor) — cost_summary { ready, total_cents, event_count } ──
    const cost = asObj(costRes);
    const costReady = cost && cost.ready === true;
    const cost_cents = costReady ? intOf(cost.total_cents) : 0;
    const cost_count = costReady ? intOf(cost.event_count) : 0;

    // ── OPERAÇÃO + FECHA + RISCO — ops_board { ready, stats:{total,done,no_show,overdue,...} } ──
    const ops = asObj(opsRes);
    const opsReady = ops && ops.ready === true;
    const st = (opsReady && ops.stats && typeof ops.stats === "object") ? ops.stats : {};
    const jobs_total = intOf(st.total);
    const jobs_done = intOf(st.done);
    const jobs_risk = intOf(st.no_show) + intOf(st.overdue); // fell through / overdue = return risk

    // ── LUCRO — revenue_month { total_cents } (source of truth) ──
    const revReady = revRes && typeof revRes === "object" && Number.isFinite(Number(revRes.total_cents));
    const revenue_cents = revReady ? intOf(revRes.total_cents) : 0;
    const profit_cents = (revReady) ? Math.max(0, revenue_cents - cost_cents) : 0;

    // ── RISCO em R$ — prefer the REAL, amount-anchored refund total (refund_total_window). Only if the
    //    tenant has no refund data do we fall back to the honest avg-ticket EXPOSURE estimate. ──
    const ret = asObj(refRes);
    const retReady = ret && ret.ready === true;
    const refund_cents = retReady ? intOf(ret.refund_cents) : 0;
    const refund_count = retReady ? intOf(ret.refund_count) : 0;
    const dispute_cents = retReady ? intOf(ret.dispute_cents) : 0;
    const dispute_count = retReady ? intOf(ret.dispute_count) : 0;
    const returns_cents = refund_cents + dispute_cents;
    const returns_count = refund_count + dispute_count;
    const risk_real = retReady && returns_count > 0;
    const avg_ticket = (revReady && jobs_done > 0) ? Math.round(revenue_cents / jobs_done) : 0;
    const risk_cents = risk_real ? returns_cents : (avg_ticket > 0 ? avg_ticket * jobs_risk : 0);

    const ready = costReady || opsReady || revReady;

    // ── IDIOMA DA TELA (incidente 2026-09-28) ──────────────────────────────────────────────
    // Rótulos e notas saíam em português fixo — e, quando faltava dado, a nota era uma ordem de
    // engenharia ("Instale db/operations.sql") lida pelo DONO DO SPA numa interface em inglês.
    // Agora: `lang` do corpo (en|pt|es|hi) → idioma do cadastro → en. A frase da tela é segura;
    // o arquivo SQL que falta vai em `detalhe_tecnico` do estágio, só para o admin.
    const lg = (() => {
      const ok = ["en", "pt", "es", "hi"];
      const a1 = String(b.lang || "").toLowerCase().slice(0, 2); if (ok.includes(a1)) return a1;
      const a2 = String((gdj.identity && gdj.identity.lang) || "").toLowerCase().slice(0, 2); return ok.includes(a2) ? a2 : "en";
    })();
    const T = {
      en: { supplier: "Supplier · Cost", operation: "Operation · Gui at work", close: "Customer closes", profit: "Profit in hand", risk: "Return risk",
        n_cost: "What it costs for Gui to operate (voice, SMS, providers).", n_ops: "Services Gui handled in this period.", n_close: "Completed services — the money came in.", n_profit: "Revenue minus the cost to operate.",
        sem_dado: "Not measured for your account yet.", refund: (n) => `${n} refund(s)`, dispute: (n) => `${n} dispute(s)/chargeback(s)`, voltou: " — money that went back to the customer.",
        em_risco: (n, est) => `${n} service(s) at risk (no-shows/late)${est ? " · exposure estimated from the average ticket" : ""}.`, saudavel: "No refunds and no services at risk in this period — healthy." },
      pt: { supplier: "Fornecedor · Custo", operation: "Operação · Gui trabalha", close: "Cliente fecha", profit: "Lucro na mão", risk: "Risco de retorno",
        n_cost: "O que custa pra Gui operar (voz, SMS, provedores).", n_ops: "Serviços que a Gui conduziu na janela.", n_close: "Serviços concluídos — o dinheiro entrou.", n_profit: "Receita menos o custo de operar.",
        sem_dado: "Ainda não medido para a sua conta.", refund: (n) => `${n} reembolso(s)`, dispute: (n) => `${n} disputa(s)/chargeback`, voltou: " — dinheiro que voltou pro cliente.",
        em_risco: (n, est) => `${n} serviço(s) em risco (faltas/atrasos)${est ? " · exposição estimada pelo ticket médio" : ""}.`, saudavel: "Nenhum reembolso e nenhum serviço em risco na janela — saudável." },
      es: { supplier: "Proveedor · Costo", operation: "Operación · Gui trabaja", close: "El cliente cierra", profit: "Ganancia en mano", risk: "Riesgo de devolución",
        n_cost: "Lo que cuesta que Gui opere (voz, SMS, proveedores).", n_ops: "Servicios que Gui atendió en este período.", n_close: "Servicios completados — el dinero entró.", n_profit: "Ingresos menos el costo de operar.",
        sem_dado: "Aún no se mide para su cuenta.", refund: (n) => `${n} reembolso(s)`, dispute: (n) => `${n} disputa(s)/contracargo(s)`, voltou: " — dinero que volvió al cliente.",
        em_risco: (n, est) => `${n} servicio(s) en riesgo (ausencias/retrasos)${est ? " · exposición estimada por el ticket promedio" : ""}.`, saudavel: "Sin reembolsos ni servicios en riesgo en este período — saludable." },
      hi: { supplier: "आपूर्तिकर्ता · लागत", operation: "संचालन · Gui काम पर", close: "ग्राहक ने पूरा किया", profit: "हाथ में मुनाफ़ा", risk: "वापसी का जोखिम",
        n_cost: "Gui को चलाने की लागत (वॉइस, एसएमएस, प्रदाता)।", n_ops: "इस अवधि में Gui द्वारा संभाली गई सेवाएँ।", n_close: "पूरी हुई सेवाएँ — पैसा आ गया।", n_profit: "राजस्व में से संचालन की लागत घटाकर।",
        sem_dado: "आपके खाते के लिए अभी मापा नहीं गया है।", refund: (n) => `${n} रिफ़ंड`, dispute: (n) => `${n} विवाद/चार्जबैक`, voltou: " — पैसा जो ग्राहक को वापस गया।",
        em_risco: (n, est) => `${n} सेवा(एँ) जोखिम में (अनुपस्थिति/देरी)${est ? " · औसत टिकट से अनुमानित जोखिम" : ""}।`, saudavel: "इस अवधि में कोई रिफ़ंड नहीं और कोई सेवा जोखिम में नहीं — स्वस्थ।" },
    }[lg];
    const FALTA_OPS = "db/operations.sql (ops_board) não respondeu";
    const FALTA_COST = "db/cost_ledger.sql (cost_summary) não respondeu";
    const FALTA_REV = "db/revenue_month.sql (revenue_month) não respondeu";
    const sem = (tecnico) => ({ note: T.sem_dado, detalhe_tecnico: tecnico });

    const stages = [
      {
        key: "supplier", label: T.supplier, kind: "supplier",
        count: cost_count, amount_cents: cost_cents,
        ...(costReady ? { note: T.n_cost } : sem(FALTA_COST)),
      },
      {
        key: "operation", label: T.operation, kind: "operation",
        count: jobs_total, amount_cents: null,
        ...(opsReady ? { note: T.n_ops } : sem(FALTA_OPS)),
      },
      {
        key: "close", label: T.close, kind: "close",
        count: jobs_done, amount_cents: revReady ? revenue_cents : null,
        ...(opsReady ? { note: T.n_close } : sem(FALTA_OPS)),
      },
      {
        key: "profit", label: T.profit, kind: "profit",
        count: null, amount_cents: profit_cents,
        ...(revReady ? { note: T.n_profit } : sem(FALTA_REV)),
      },
      {
        key: "risk", label: T.risk, kind: "risk",
        count: risk_real ? returns_count : jobs_risk, amount_cents: risk_cents,
        real: risk_real,
        refund_cents, refund_count, dispute_cents, dispute_count,
        ...(risk_real
          ? { note: [refund_count > 0 ? T.refund(refund_count) : null, dispute_count > 0 ? T.dispute(dispute_count) : null].filter(Boolean).join(" · ") + T.voltou }
          : opsReady
            ? { note: jobs_risk > 0 ? T.em_risco(jobs_risk, avg_ticket > 0) : T.saudavel }
            : sem(FALTA_OPS)),
      },
    ];

    return json({
      ok: true,
      ready,
      lang: lg,
      window: { from: winFrom, to: winTo },
      stages,
      money: { cost_cents, revenue_cents, profit_cents, risk_cents, refund_cents, dispute_cents },
    });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
