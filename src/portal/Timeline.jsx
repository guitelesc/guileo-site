/* Linha do tempo tab — "Do fornecedor ao cliente" (Luis's concept).
   ONE horizontal money-flow the owner reads left→right, with money annotated at each node:
     FORNECEDOR/CUSTO → OPERAÇÃO (Gui trabalha) → CLIENTE FECHA → LUCRO NA MÃO → RISCO DE RETORNO
   REAL mode (real + email + dataKey): live from /api/timeline (cost_summary + ops_board + revenue_month,
   tenant-gated exactly like /api/operations). Falls back to the demo view otherwise, so it looks alive
   before an account is connected. Cement-locked (#161512) + signal palette, mirroring the sibling tabs. */
import { useEffect, useState } from "react";
import { loadDataKey, chamarApi } from "../lib/portalApi.js";
import { Card, SectionSkeleton, UI_LANG } from "../pages/Portal.jsx";
import FalhaDeLeitura from "./FalhaDeLeitura.jsx";

// signal palette (cimento locked): supplier muted · operation Gui-orange · close info-blue · profit done-green · risk attention-amber
const GUI = "#FF8A33", INFO = "#5B9BD5", OK = "#3E9468", AMBER = "#FFC23D", MUTE = "#948C7B", ALERT = "#e0855f";
const KIND_COLOR = { supplier: MUTE, operation: GUI, close: INFO, profit: OK, risk: AMBER };
const KIND_ICON = { supplier: "🏭", operation: "⚙️", close: "🤝", profit: "🌱", risk: "↩️" };

const STR = {
  en: {
    customer: "Customer", falhou: "I couldn't load your timeline just now.",
    notOn: "Your money timeline isn't switched on for your account yet. Message our team and we'll turn it on.",
    nSupplier: "What it costs Gui to operate (voice, texts, providers).", nOperation: "Jobs Gui handled in this window.",
    nClose: "Completed jobs — the money came in.", nProfit: "Revenue minus the cost of operating.",
    nNotMeasured: "Not measured for your account yet.", nRefunds: "refund(s)", nDisputes: "dispute(s)/chargeback(s)",
    nWentBack: "money that went back to the customer.", nAtRisk: "job(s) at risk (no-shows/delays)",
    nHealthy: "No refunds and no jobs at risk in this window — healthy.",
    title: "From supplier to customer", live: "LIVE", est: "sample",
    sub: "Your whole flow, left to right — from cost to profit in your hand, and the return risk.",
    window: "This month", cost: "Cost", revenue: "Revenue", profit: "Profit", risk: "Return risk",
    jobs: "jobs", events: "events", closed: "closed", atRisk: "at risk", noAmt: "—",
    summary: "The money, end to end", flowNote: "Gui turns supplier cost into profit in your hand — and flags what could come back.",
    sample: "Sample data — connect your account to see your real flow.",
    notReady: "Connect your account and install the money engines to see your real timeline.",
    recoverTitle: "Recover the return risk", recoverSub: "One click and Gui reaches out to win each customer back.",
    recover: "Gui recover →", sending: "Sending…", reaching: "Gui is reaching out ✓",
    queued: "Queued — Gui will reach out ✓", recFail: "Couldn't queue — retry",
    riskWord: "risk", daysAgo: "d ago", ltvWord: "at risk",
  },
  pt: {
    customer: "Cliente", falhou: "Não consegui carregar a sua linha do tempo agora.",
    notOn: "A sua linha do tempo do dinheiro ainda não está ligada para a sua conta. Fale com a nossa equipe e a gente liga.",
    nSupplier: "O que custa pra Gui operar (voz, mensagens, provedores).", nOperation: "Serviços que a Gui conduziu nesta janela.",
    nClose: "Serviços concluídos — o dinheiro entrou.", nProfit: "Receita menos o custo de operar.",
    nNotMeasured: "Ainda não medido para a sua conta.", nRefunds: "reembolso(s)", nDisputes: "disputa(s)/chargeback(s)",
    nWentBack: "dinheiro que voltou pro cliente.", nAtRisk: "serviço(s) em risco (faltas/atrasos)",
    nHealthy: "Nenhum reembolso e nenhum serviço em risco nesta janela — saudável.",
    title: "Do fornecedor ao cliente", live: "AO VIVO", est: "exemplo",
    sub: "Seu fluxo inteiro, da esquerda pra direita — do custo ao lucro na sua mão, e o risco de retorno.",
    window: "Este mês", cost: "Custo", revenue: "Receita", profit: "Lucro", risk: "Risco de retorno",
    jobs: "serviços", events: "eventos", closed: "fechados", atRisk: "em risco", noAmt: "—",
    summary: "O dinheiro, de ponta a ponta", flowNote: "A Gui transforma o custo do fornecedor em lucro na sua mão — e sinaliza o que pode voltar.",
    sample: "Dados de exemplo — conecte sua conta para ver seu fluxo real.",
    notReady: "Conecte sua conta e instale os motores de dinheiro para ver sua linha do tempo real.",
    recoverTitle: "Recupere o risco de retorno", recoverSub: "Um clique e a Gui vai atrás de cada cliente pra trazer de volta.",
    recover: "Gui recupera →", sending: "Enviando…", reaching: "Gui está indo atrás ✓",
    queued: "Na fila — a Gui vai atrás ✓", recFail: "Não deu — tentar de novo",
    riskWord: "risco", daysAgo: "d atrás", ltvWord: "em risco",
  },
  es: {
    customer: "Cliente", falhou: "No pude cargar tu línea de tiempo ahora.",
    notOn: "Tu línea de tiempo del dinero aún no está activada para tu cuenta. Escríbele a nuestro equipo y la activamos.",
    nSupplier: "Lo que le cuesta a Gui operar (voz, mensajes, proveedores).", nOperation: "Servicios que Gui atendió en esta ventana.",
    nClose: "Servicios completados — el dinero entró.", nProfit: "Ingresos menos el costo de operar.",
    nNotMeasured: "Aún no medido para tu cuenta.", nRefunds: "reembolso(s)", nDisputes: "disputa(s)/contracargo(s)",
    nWentBack: "dinero que volvió al cliente.", nAtRisk: "servicio(s) en riesgo (ausencias/retrasos)",
    nHealthy: "Sin reembolsos ni servicios en riesgo en esta ventana — saludable.",
    title: "Del proveedor al cliente", live: "EN VIVO", est: "ejemplo",
    sub: "Todo tu flujo, de izquierda a derecha — del costo a la ganancia en tu mano, y el riesgo de retorno.",
    window: "Este mes", cost: "Costo", revenue: "Ingresos", profit: "Ganancia", risk: "Riesgo de retorno",
    jobs: "servicios", events: "eventos", closed: "cerrados", atRisk: "en riesgo", noAmt: "—",
    summary: "El dinero, de punta a punta", flowNote: "Gui convierte el costo del proveedor en ganancia en tu mano — y señala lo que puede volver.",
    sample: "Datos de ejemplo — conecta tu cuenta para ver tu flujo real.",
    notReady: "Conecta tu cuenta e instala los motores de dinero para ver tu línea de tiempo real.",
    recoverTitle: "Recupera el riesgo de retorno", recoverSub: "Un clic y Gui contacta a cada cliente para recuperarlo.",
    recover: "Gui recupera →", sending: "Enviando…", reaching: "Gui está contactando ✓",
    queued: "En cola — Gui contactará ✓", recFail: "No se pudo — reintentar",
    riskWord: "riesgo", daysAgo: "d atrás", ltvWord: "en riesgo",
  },
  hi: {
    customer: "ग्राहक", falhou: "मैं अभी आपकी टाइमलाइन लोड नहीं कर सका।",
    notOn: "आपकी मनी टाइमलाइन अभी आपके खाते के लिए चालू नहीं है। हमारी टीम को संदेश भेजें, हम चालू कर देंगे।",
    nSupplier: "Gui को चलाने की लागत (वॉइस, संदेश, प्रदाता)।", nOperation: "इस अवधि में Gui द्वारा संभाले गए काम।",
    nClose: "पूरे हुए काम — पैसा आ गया।", nProfit: "आय में से संचालन की लागत घटाकर।",
    nNotMeasured: "आपके खाते के लिए अभी मापा नहीं गया।", nRefunds: "रिफंड", nDisputes: "विवाद/चार्जबैक",
    nWentBack: "पैसा जो ग्राहक को वापस गया।", nAtRisk: "काम जोखिम में (नो-शो/देरी)",
    nHealthy: "इस अवधि में कोई रिफंड नहीं और कोई काम जोखिम में नहीं — स्वस्थ।",
    title: "आपूर्तिकर्ता से ग्राहक तक", live: "लाइव", est: "नमूना",
    sub: "आपका पूरा प्रवाह, बाएँ से दाएँ — लागत से लेकर आपके हाथ में मुनाफ़ा, और वापसी का जोखिम।",
    window: "इस महीने", cost: "लागत", revenue: "आय", profit: "मुनाफ़ा", risk: "वापसी जोखिम",
    jobs: "सेवाएँ", events: "इवेंट", closed: "बंद", atRisk: "जोखिम में", noAmt: "—",
    summary: "पैसा, शुरू से अंत तक", flowNote: "Gui आपूर्तिकर्ता की लागत को आपके हाथ में मुनाफ़े में बदलती है — और जो लौट सकता है उसे चिह्नित करती है।",
    sample: "नमूना डेटा — अपना असली प्रवाह देखने के लिए खाता जोड़ें।",
    notReady: "अपनी असली टाइमलाइन देखने के लिए खाता जोड़ें और मनी इंजन इंस्टॉल करें।",
    recoverTitle: "वापसी जोखिम की भरपाई करें", recoverSub: "एक क्लिक और Gui हर ग्राहक को वापस लाने के लिए संपर्क करती है।",
    recover: "Gui वापस लाए →", sending: "भेज रहे…", reaching: "Gui संपर्क कर रही है ✓",
    queued: "कतार में — Gui संपर्क करेगी ✓", recFail: "विफल — पुनः प्रयास",
    riskWord: "जोखिम", daysAgo: "द पहले", ltvWord: "जोखिम में",
  },
};
const T = (k) => (STR[UI_LANG] || STR.en)[k] || STR.en[k] || k;

const LOCALE = () => (UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es" : UI_LANG === "hi" ? "hi-IN" : "en-US");
const money = (cents) => {
  if (!Number.isFinite(Number(cents))) return T("noAmt");
  const v = Number(cents) / 100;
  try { return v.toLocaleString(LOCALE(), { style: "currency", currency: UI_LANG === "en" ? "USD" : "BRL", maximumFractionDigits: 0 }); }
  catch { return `$${Math.round(v)}`; }
};
const num = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString(LOCALE()) : "—");
const isEmailAddr = (s) => /.+@.+\..+/.test((s || "").toString());
// The real contact we can hand the reengage path: a valid email (Gui reactivates NOW) or, failing that,
// a phone (queued for SMS/call). Empty → the row is NOT recoverable and must be hidden.
const contactOf = (r) => {
  const e = ((r && r.contact_email) || "").toString().trim();
  if (isEmailAddr(e)) return e;
  const p = ((r && r.phone) || "").toString().trim();
  return p || "";
};

// ── deterministic demo payload (mirrors how the sibling tabs fake a live-looking flow) ──
function genDemo(V) {
  const seed = (V && V.label ? String(V.label) : "demo").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const pick = (lo, hi, salt) => lo + (((seed * 31 + salt * 17) % 1000) / 1000) * (hi - lo);
  const cost = Math.round(pick(180, 620, 1)) * 100;
  const jobs = Math.round(pick(38, 140, 2));
  const done = Math.round(jobs * pick(0.62, 0.86, 3));
  const revenue = done * Math.round(pick(90, 260, 4)) * 100;
  const profit = Math.max(0, revenue - cost);
  const risk = Math.max(0, jobs - done) + Math.round(pick(0, 3, 5));
  const avg = done > 0 ? Math.round(revenue / done) : 0;
  return {
    ready: true, demo: true, window: { from: null, to: null },
    money: { cost_cents: cost, revenue_cents: revenue, profit_cents: profit, risk_cents: avg * risk },
    stages: [
      { key: "supplier", label: T("title"), kind: "supplier", count: Math.round(pick(20, 90, 6)), amount_cents: cost },
      { key: "operation", label: "", kind: "operation", count: jobs, amount_cents: null },
      { key: "close", label: "", kind: "close", count: done, amount_cents: revenue },
      { key: "profit", label: "", kind: "profit", count: null, amount_cents: profit },
      { key: "risk", label: "", kind: "risk", count: risk, amount_cents: avg * risk, refund_count: Math.max(0, risk - 1), dispute_count: 1, dispute_cents: avg },
    ],
  };
}

// 🌐 (2026-09-28) NOTA DE CADA ETAPA — montada AQUI, a partir dos números, no idioma da tela.
// O servidor manda a nota pronta em português ("Serviços concluídos — o dinheiro entrou.") e,
// quando a etapa não é medida, manda instrução de ENGENHARIA ("Instale db/cost_ledger.sql…").
// As duas coisas iam direto para a tela de uma cliente que lê inglês. A nota do servidor só é
// usada se ele confirmar que respondeu no idioma pedido (`lang` ecoado) E não for de engenharia.
const ehEngenharia = (t) => /\bdb\/[\w.-]+|\.sql\b|supabase|cloudflare|\benv\b|_KEY\b|_SECRET\b|INGEST|instale|paste|HTTP \d{3}/i.test(String(t || ""));
const notaDoEstagio = (st, langDoServidor) => {
  const crua = String(st.note || "");
  if (crua && ehEngenharia(crua)) return T("nNotMeasured");
  if (crua && langDoServidor && langDoServidor === UI_LANG) return crua;
  if (!crua) return "";
  if (st.kind === "supplier") return T("nSupplier");
  if (st.kind === "operation") return T("nOperation");
  if (st.kind === "close") return T("nClose");
  if (st.kind === "profit") return T("nProfit");
  if (st.kind === "risk") {
    if (st.real) {
      const partes = [
        Number(st.refund_count) > 0 ? `${num(st.refund_count)} ${T("nRefunds")}` : null,
        Number(st.dispute_count) > 0 ? `${num(st.dispute_count)} ${T("nDisputes")}` : null,
      ].filter(Boolean).join(" · ");
      return `${partes} — ${T("nWentBack")}`;
    }
    return Number(st.count) > 0 ? `${num(st.count)} ${T("nAtRisk")}` : T("nHealthy");
  }
  return "";
};

const STAGE_LABEL = (k) => {
  const m = {
    supplier: T("cost"), operation: T("jobs"), close: T("closed"), profit: T("profit"), risk: T("risk"),
  };
  return m[k] || k;
};

function Node({ stage, i, langDoServidor }) {
  const c = KIND_COLOR[stage.kind] || MUTE;
  const nota = notaDoEstagio(stage, langDoServidor);
  const hasAmt = Number.isFinite(Number(stage.amount_cents));
  return (
    <div className="relative flex flex-col items-center text-center shrink-0 w-[128px] sm:w-auto sm:flex-1"
      style={{ animationDelay: `${Math.min(i, 6) * 70}ms` }}>
      {/* the node dot */}
      <div className="relative grid place-items-center h-14 w-14 rounded-full text-xl"
        style={{ background: c + "1e", boxShadow: `inset 0 0 0 1.5px ${c}66, 0 0 22px ${c}22` }}>
        <span>{KIND_ICON[stage.kind] || "•"}</span>
        {stage.kind === "operation" && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: c }} />}
      </div>
      <div className="mt-2 text-[10px] font-black uppercase tracking-wider" style={{ color: c }}>{STAGE_LABEL(stage.kind)}</div>
      {/* the number line: count and/or money */}
      <div className="mt-1 min-h-[2.4rem]">
        {hasAmt && <div className="text-base sm:text-lg font-black num leading-tight" style={{ color: c, textShadow: `0 0 16px ${c}33` }}>{money(stage.amount_cents)}</div>}
        {Number.isFinite(Number(stage.count)) && (
          <div className="text-[11px] text-g-muted num">{num(stage.count)} {stage.kind === "risk" ? T("atRisk") : stage.kind === "close" ? T("closed") : stage.kind === "operation" ? T("jobs") : stage.kind === "supplier" ? T("events") : ""}</div>
        )}
      </div>
      {/* CHARGEBACK ALARM — a dispute is worse than a refund (money clawed back + a fee + a trust hit),
          so it gets its own red badge, distinct from the amber refund/risk. Only shows when real. */}
      {stage.kind === "risk" && Number(stage.dispute_count) > 0 && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide"
          style={{ background: "#e0855f22", color: "#e0855f", boxShadow: "inset 0 0 0 1px #e0855f55" }}>
          ⚠ {num(stage.dispute_count)} chargeback{Number(stage.dispute_count) > 1 ? "s" : ""}
          {Number.isFinite(Number(stage.dispute_cents)) && Number(stage.dispute_cents) > 0 ? ` · ${money(stage.dispute_cents)}` : ""}
        </div>
      )}
      {nota && <div className="mt-1 text-[10px] text-g-muted leading-snug max-w-[150px] mx-auto opacity-80">{nota}</div>}
    </div>
  );
}

// ── RECUPERAR O RISCO DE RETORNO — 1-clique real ──────────────────────────────
// The Timeline surfaces "return risk" money aggregate; this makes it ACTIONABLE. In REAL mode we pull the
// tenant's actual at-risk contacts (growth-intel action:"churn" → same per-tenant gate, risk>=50) and give
// each row a "Gui recover →" button that fires the REAL reengage path (action:"reengage") for THAT contact.
//   • Only real mode + a real contact (email or phone). No contact → the row is hidden (IRON RULE 1).
//   • Success is claimed ONLY on ok:true from the endpoint — sent→"reaching out", else honest "queued".
//     Anything else → honest retry button. Never a fabricated "done" (IRON RULE 2).
//   • Degrades to nothing (returns null) if not connected, SQL not pasted, or no recoverable contact —
//     it never crashes the tab and never appears in demo (IRON RULE, zero-downtime).
function ReturnRiskRecover({ email, dk }) {
  const [rows, setRows] = useState(null);  // null=loading, [] = none/hidden
  const [st, setSt] = useState({});        // idx -> "sending" | "sent" | "queued" | "error"

  useEffect(() => {
    let alive = true;
    if (!email || !dk) { setRows([]); return; }
    // Bloco OPCIONAL: se a lista não veio, ele some (a falha da tela é dita pelo bloco principal).
    chamarApi("/api/growth-intel", { email, token: dk, action: "churn", lang: UI_LANG })
      .then((r) => { if (alive) setRows(!r.motivo && r.data.ready && Array.isArray(r.data.atRisk) ? r.data.atRisk.filter(Boolean) : []); });
    return () => { alive = false; };
  }, [email, dk]);

  if (rows === null) return null; // silent while the real list is in flight — never a fake state
  const list = rows.map((r, i) => ({ r, i, contact: contactOf(r) })).filter((x) => !!x.contact);
  if (list.length === 0) return null; // degrade to hidden: no real, recoverable contact

  async function recover(r, i, contact) {
    setSt((s) => ({ ...s, [i]: "sending" }));
    const res = await chamarApi("/api/growth-intel", { email, token: dk, action: "reengage", name: r.name, contact, suggested: r.suggested_action, risk: r.risk, lang: UI_LANG });
    const j = res.motivo ? null : res.data;
    if (j && j.ok) setSt((s) => ({ ...s, [i]: j.sent ? "sent" : "queued" })); // honest: sent NOW vs queued
    else setSt((s) => ({ ...s, [i]: "error" }));
  }

  return (
    <Card>
      <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: AMBER }}>{T("recoverTitle")}</div>
      <p className="text-[11px] text-g-muted mb-3">{T("recoverSub")}</p>
      <div className="space-y-2">
        {list.map(({ r, i, contact }) => {
          const status = st[i] || "idle";
          const days = Number(r.days_since_visit);
          const ltvCents = Number.isFinite(Number(r.ltv)) ? Math.round(Number(r.ltv) * 100) : null;
          return (
            <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-bold text-g-word truncate">{r.name || T("customer")}</div>
                <div className="text-[11px] text-g-muted num truncate">
                  {Number.isFinite(Number(r.risk)) ? `${num(r.risk)}% ${T("riskWord")}` : ""}
                  {Number.isFinite(days) ? ` · ${num(days)}${T("daysAgo")}` : ""}
                  {ltvCents && ltvCents > 0 ? ` · ${money(ltvCents)} ${T("ltvWord")}` : ""}
                </div>
              </div>
              {status === "sent" || status === "queued" ? (
                <span className="shrink-0 text-[11px] font-black text-right" style={{ color: OK }}>{status === "sent" ? T("reaching") : T("queued")}</span>
              ) : status === "error" ? (
                <button onClick={() => recover(r, i, contact)} className="shrink-0 text-[11px] font-black underline" style={{ color: ALERT }}>{T("recFail")}</button>
              ) : (
                <button onClick={() => recover(r, i, contact)} disabled={status === "sending"}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition disabled:opacity-60"
                  style={{ background: GUI + "22", color: GUI, boxShadow: `inset 0 0 0 1px ${GUI}55` }}>
                  {status === "sending" ? T("sending") : T("recover")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TimelineView({ d, real, email = "", dk = "" }) {
  const stages = (Array.isArray(d.stages) ? d.stages : []).filter(Boolean);
  const m = d.money || {};
  const cost = intCents(m.cost_cents), rev = intCents(m.revenue_cents), profit = intCents(m.profit_cents), risk = intCents(m.risk_cents);
  // width of each money segment (cost + profit + risk share the revenue bar; guard div-by-zero)
  const denom = Math.max(1, cost + profit + risk);
  const segs = [
    { k: "cost", v: cost, c: MUTE, label: T("cost") },
    { k: "profit", v: profit, c: OK, label: T("profit") },
    { k: "risk", v: risk, c: risk > 0 ? AMBER : MUTE, label: T("risk") },
  ];
  return (
    <div className="space-y-4 stagger">
      {/* HERO */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.08] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: GUI }}>
          {T("title")}
          {real
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{T("live")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{T("est")}</span>}
          <span className="text-g-muted normal-case font-normal text-[10px]">· {T("window")}</span>
        </div>
        <p className="mt-1 text-xs text-g-muted max-w-2xl">{T("sub")}</p>
      </div>

      {/* THE HORIZONTAL TIMELINE — 5 connected nodes left→right */}
      <Card className="p-0 overflow-hidden">
        <div className="relative px-3 sm:px-5 py-6 overflow-x-auto">
          {/* connecting rail behind the nodes */}
          <div className="hidden sm:block absolute left-10 right-10 top-[52px] h-[2px] rounded-full"
            style={{ background: `linear-gradient(90deg, ${MUTE}55, ${GUI}, ${INFO}, ${OK}, ${AMBER}88)` }} />
          <div className="relative flex sm:grid sm:grid-cols-5 gap-2 sm:gap-1 items-start min-w-[560px] sm:min-w-0">
            {stages.map((s, i) => <Node key={s.key || i} stage={s} i={i} langDoServidor={d.lang} />)}
          </div>
        </div>
      </Card>

      {/* MONEY SUMMARY BAR — Custo → Receita → Lucro (verde) → Risco (âmbar) */}
      <Card>
        <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{T("summary")}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Metric label={T("cost")} value={money(cost)} color={MUTE} />
          <Metric label={T("revenue")} value={money(rev)} color={INFO} />
          <Metric label={T("profit")} value={money(profit)} color={OK} big />
          <Metric label={T("risk")} value={money(risk)} color={risk > 0 ? ALERT : MUTE} />
        </div>
        {/* the stacked composition of revenue */}
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/[0.05]">
          {segs.map((s) => s.v > 0 && (
            <div key={s.k} style={{ width: `${(s.v / denom) * 100}%`, background: s.c }} title={`${s.label} ${money(s.v)}`} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold">
          {segs.map((s) => (
            <span key={s.k} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.c }} />
              <span className="text-g-word num">{money(s.v)}</span>
              <span className="text-g-muted font-normal">{s.label}</span>
            </span>
          ))}
        </div>
        <div className="mt-3 text-[11px] text-g-muted leading-snug">{T("flowNote")}</div>
      </Card>

      {/* 1-CLICK RECOVER — only real mode + real contact; self-hides otherwise (never in demo) */}
      {real && email && dk && <ReturnRiskRecover email={email} dk={dk} />}
    </div>
  );
}

const intCents = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);

function Metric({ label, value, color, big }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="text-[10px] font-black uppercase tracking-wider text-g-muted">{label}</div>
      <div className={`${big ? "text-xl" : "text-base"} font-black num mt-0.5`} style={{ color, textShadow: big ? `0 0 16px ${color}33` : "none" }}>{value}</div>
    </div>
  );
}

function Timeline({ V, real = null, email = "", dataKey = "" }) {
  const dk = dataKey || loadDataKey();
  const [data, setData] = useState(null); // null = fetch in flight (real mode)
  const [falha, setFalha] = useState(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let alive = true;
    // 🚨 (2026-09-28) Dois defeitos aqui. (1) Conta real SEM chave/e-mail: `data` ficava null e a
    // tela era esqueleto para sempre. (2) Falha de leitura virava `{ready:false}` e a tela dizia
    // "Connect your account and install the money engines" — para quem JÁ está conectada, e
    // pedindo que a cliente "instale motores".
    if (!real) { setData(null); setFalha(null); return; }
    if (!email || !dk) { setFalha("sem_credencial"); setData({ ready: false }); return; }
    setData(null); setFalha(null);
    chamarApi("/api/timeline", { email, dataKey: dk, lang: UI_LANG }).then((r) => {
      if (!alive) return;
      if (r.motivo) { setFalha(r.motivo); setData({ ready: false }); return; }
      setData(r.data);
    });
    return () => { alive = false; };
  }, [real, email, dk, tentativa]);

  const demo = !real;
  if (real && data === null) return <SectionSkeleton rows={5} />;
  if (real && falha) return <FalhaDeLeitura motivo={falha} onRetry={() => setTentativa((n) => n + 1)} titulo={T("falhou")} />;

  const d = demo ? genDemo(V) : (data || { ready: false });

  // Honest not-ready: connected but no money engines installed → show the note, never a fabricated flow.
  if (!demo && !d.ready) {
    return (
      <div className="space-y-4 stagger">
        <Card>
          {/* a nota do servidor aqui é de engenharia ("Instale db/…sql") — a tela diz a versão da cliente */}
          <div className="text-sm text-g-muted">{T("notOn")}</div>
        </Card>
      </div>
    );
  }

  return (
    <>
      {demo && (
        <div className="mb-4 rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {T("sample")}
        </div>
      )}
      <TimelineView d={d} real={!!real} email={email} dk={dk} />
    </>
  );
}

export default Timeline;
