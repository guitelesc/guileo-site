/* Linha do tempo tab — "Do fornecedor ao cliente" (Luis's concept).
   ONE horizontal money-flow the owner reads left→right, with money annotated at each node:
     FORNECEDOR/CUSTO → OPERAÇÃO (Gui trabalha) → CLIENTE FECHA → LUCRO NA MÃO → RISCO DE RETORNO
   REAL mode (real + email + dataKey): live from /api/timeline (cost_summary + ops_board + revenue_month,
   tenant-gated exactly like /api/operations). Falls back to the demo view otherwise, so it looks alive
   before an account is connected. Cement-locked (#161512) + signal palette, mirroring the sibling tabs. */
import { useEffect, useState } from "react";
import { loadDataKey } from "../lib/portalApi.js";
import { Card, SectionSkeleton, UI_LANG } from "../pages/Portal.jsx";

// signal palette (cimento locked): supplier muted · operation Gui-orange · close info-blue · profit done-green · risk attention-amber
const GUI = "#FF8A33", INFO = "#5B9BD5", OK = "#3E9468", AMBER = "#FFC23D", MUTE = "#948C7B", ALERT = "#e0855f";
const KIND_COLOR = { supplier: MUTE, operation: GUI, close: INFO, profit: OK, risk: AMBER };
const KIND_ICON = { supplier: "🏭", operation: "⚙️", close: "🤝", profit: "🌱", risk: "↩️" };

const STR = {
  en: {
    title: "From supplier to customer", live: "LIVE", est: "sample",
    sub: "Your whole flow, left to right — from cost to profit in your hand, and the return risk.",
    window: "This month", cost: "Cost", revenue: "Revenue", profit: "Profit", risk: "Return risk",
    jobs: "jobs", events: "events", closed: "closed", atRisk: "at risk", noAmt: "—",
    summary: "The money, end to end", flowNote: "Gui turns supplier cost into profit in your hand — and flags what could come back.",
    sample: "Sample data — connect your account to see your real flow.",
    notReady: "Connect your account and install the money engines to see your real timeline.",
  },
  pt: {
    title: "Do fornecedor ao cliente", live: "AO VIVO", est: "exemplo",
    sub: "Seu fluxo inteiro, da esquerda pra direita — do custo ao lucro na sua mão, e o risco de retorno.",
    window: "Este mês", cost: "Custo", revenue: "Receita", profit: "Lucro", risk: "Risco de retorno",
    jobs: "serviços", events: "eventos", closed: "fechados", atRisk: "em risco", noAmt: "—",
    summary: "O dinheiro, de ponta a ponta", flowNote: "A Gui transforma o custo do fornecedor em lucro na sua mão — e sinaliza o que pode voltar.",
    sample: "Dados de exemplo — conecte sua conta para ver seu fluxo real.",
    notReady: "Conecte sua conta e instale os motores de dinheiro para ver sua linha do tempo real.",
  },
  es: {
    title: "Del proveedor al cliente", live: "EN VIVO", est: "ejemplo",
    sub: "Todo tu flujo, de izquierda a derecha — del costo a la ganancia en tu mano, y el riesgo de retorno.",
    window: "Este mes", cost: "Costo", revenue: "Ingresos", profit: "Ganancia", risk: "Riesgo de retorno",
    jobs: "servicios", events: "eventos", closed: "cerrados", atRisk: "en riesgo", noAmt: "—",
    summary: "El dinero, de punta a punta", flowNote: "Gui convierte el costo del proveedor en ganancia en tu mano — y señala lo que puede volver.",
    sample: "Datos de ejemplo — conecta tu cuenta para ver tu flujo real.",
    notReady: "Conecta tu cuenta e instala los motores de dinero para ver tu línea de tiempo real.",
  },
  hi: {
    title: "आपूर्तिकर्ता से ग्राहक तक", live: "लाइव", est: "नमूना",
    sub: "आपका पूरा प्रवाह, बाएँ से दाएँ — लागत से लेकर आपके हाथ में मुनाफ़ा, और वापसी का जोखिम।",
    window: "इस महीने", cost: "लागत", revenue: "आय", profit: "मुनाफ़ा", risk: "वापसी जोखिम",
    jobs: "सेवाएँ", events: "इवेंट", closed: "बंद", atRisk: "जोखिम में", noAmt: "—",
    summary: "पैसा, शुरू से अंत तक", flowNote: "Gui आपूर्तिकर्ता की लागत को आपके हाथ में मुनाफ़े में बदलती है — और जो लौट सकता है उसे चिह्नित करती है।",
    sample: "नमूना डेटा — अपना असली प्रवाह देखने के लिए खाता जोड़ें।",
    notReady: "अपनी असली टाइमलाइन देखने के लिए खाता जोड़ें और मनी इंजन इंस्टॉल करें।",
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

const STAGE_LABEL = (k) => {
  const m = {
    supplier: T("cost"), operation: T("jobs"), close: T("closed"), profit: T("profit"), risk: T("risk"),
  };
  return m[k] || k;
};

function Node({ stage, i }) {
  const c = KIND_COLOR[stage.kind] || MUTE;
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
      {stage.note && <div className="mt-1 text-[10px] text-g-muted leading-snug max-w-[150px] mx-auto opacity-80">{stage.note}</div>}
    </div>
  );
}

function TimelineView({ d, real }) {
  const stages = Array.isArray(d.stages) ? d.stages : [];
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
            {stages.map((s, i) => <Node key={s.key || i} stage={s} i={i} />)}
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

  useEffect(() => {
    let alive = true;
    if (!real || !email || !dk) { setData(null); return; }
    fetch("/api/timeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, dataKey: dk }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setData(j || { ready: false }); })
      .catch(() => { if (alive) setData({ ready: false }); });
    return () => { alive = false; };
  }, [real, email, dk]);

  const demo = !real;
  if (real && data === null) return <SectionSkeleton rows={5} />;

  const d = demo ? genDemo(V) : (data || { ready: false });

  // Honest not-ready: connected but no money engines installed → show the note, never a fabricated flow.
  if (!demo && !d.ready) {
    return (
      <div className="space-y-4 stagger">
        <Card>
          <div className="text-sm text-g-muted">{d.note || T("notReady")}</div>
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
      <TimelineView d={d} real={!!real} />
    </>
  );
}

export default Timeline;
