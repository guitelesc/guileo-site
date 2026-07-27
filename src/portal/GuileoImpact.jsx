/* Split out of Portal.jsx (performance): GuileoImpact tab view. */
import { useState, useEffect } from "react";
import { FaDownload } from "react-icons/fa6";
import { portalApi, toast, loadDataKey } from "../lib/portalApi.js";
import { Count } from "../lib/ui.jsx";
import { genImpact, loadCreated, relTime, Card, tr, Bars } from "../pages/Portal.jsx";

// The tenant PAYING Guileo (subscription / credit top-up) must NEVER count as growth Gui drove —
// the ROI is the money Gui made the client, not the money the client pays us. In this data model a
// `payment` event = a charge to Guileo (stripe-webhook ingests it; client-report treats it as guiCost).
// Customer money the agent collects is type sale/order/invoice/deposit/booking. Channel/summary
// signals reinforce it. (get_client_data returns no payload, so the old `!e.payload?.kind` test was
// always-true and silently dropped EVERY payment — this replaces it with a real type/channel/summary rule.)
const isGuileoPayment = (e) =>
  !!e && e.type === "payment" && !/^💳/.test(e.summary || "") && (
    /stripe|mercado\s?pago|mercadopago|system|billing/i.test(e.channel || "") ||
    /plan|subscription|assinat|recarga|top-?up|credit|cr[eé]dito|renew|invoice guileo/i.test(e.summary || "") ||
    !(e.channel || "").trim() // a bare payment with no channel = our own charge
  );

function inThisMonth(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const now = new Date();
  return t >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

function GuileoImpact({ V, real = null, email = "", dataKey = "" }) {
  const d = genImpact(V);
  // REAL MODE ignores the local 'created:impact' ledger (demo clicks inflated ROI) — only real data.
  const created = real ? [] : loadCreated(V.label, "impact");

  // Authoritative month revenue from the SAME spine as the weekly email (/api/revenue → revenue_month).
  const [rev, setRev] = useState(null);
  const dk = dataKey || loadDataKey();
  useEffect(() => {
    let alive = true;
    if (!real || !email || !dk) { setRev(null); return; }
    fetch("/api/revenue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: dk, email }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setRev(j && j.ok ? j : null); })
      .catch(() => { if (alive) setRev(null); });
    return () => { alive = false; };
  }, [real, email, dk]);
  const revMonthUsd = rev && rev.ready && Number.isFinite(rev.month_cents) ? rev.month_cents / 100 : null;
  const revSeries = Array.isArray(rev?.series) && rev.series.some((n) => n > 0) ? rev.series : null;

  // This calendar month's growth events (header says "this month"), excluding what the tenant pays us.
  const monthGrowth = real ? (real.events || []).filter((e) => inThisMonth(e.created_at) && !isGuileoPayment(e)) : [];
  // The ledger LIST shows positive growth rows; NET (headline fallback) includes refunds (negatives).
  const realRows = monthGrowth
    .filter((e) => Number(e.amount) > 0)
    .map((e) => [relTime(e.created_at), e.summary, Math.round(Number(e.amount))]);
  const eventNet = Math.max(0, monthGrowth.reduce((s, e) => s + (Number(e.amount) || 0), 0));
  // Headline = the ledger truth when loaded (matches the email); else the honest event-derived net.
  const realTotal = revMonthUsd != null ? Math.round(revMonthUsd) : eventNet;

  const events = [...realRows, ...created.map((e) => [e.t, e.what, e.amt]), ...(real ? [] : d.events)];
  const extra = created.reduce((s, e) => s + (e.amt || 0), 0);
  const total = (real ? realTotal : d.total) + extra;
  // HONEST return: based on REAL credits spent (gui_usage ledger), not a fabricated % of growth.
  const usage = portalApi.loadState("gui_usage", []);
  const creditsUsed = Array.isArray(usage) ? usage.reduce((s, u) => s + (u?.cost || 0), 0) : 0;
  const spentUsd = creditsUsed * 0.04; // ~ $0.04 / credit (pay-as-you-go)
  const roi = spentUsd > 0 ? total / spentUsd : 0;
  const showChart = real ? !!revSeries : Array.isArray(V.revenue) && V.revenue.length > 0;
  const chartData = real ? revSeries : V.revenue;
  return (
    <div className="space-y-4 stagger">
      <Card className="relative overflow-hidden bg-gradient-to-br from-g-green/[0.12] to-g-gold/[0.06] border-g-green/30">
        <div className="absolute -top-16 -right-12 h-44 w-44 rounded-full bg-g-green/15 blur-3xl pointer-events-none animate-aurora" />
        <div className="relative">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Growth Guileo drove · this month")}</div>
          <div className="text-4xl sm:text-5xl font-black text-g-green money-glow num tracking-tight mt-1"><Count key={total} to={total} prefix="$" /></div>
          <div className="mt-2.5 flex flex-wrap gap-2">{(real ? [] : d.parts).map(([label, val]) => (<span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold"><span className="text-g-green num">{val}</span><span className="text-g-muted">{tr(label)}</span></span>))}{real && <span className="inline-flex items-center gap-1.5 rounded-full bg-g-green/15 border border-g-green/40 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>}</div>
        </div>
      </Card>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card tone="green" className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Growth ledger · every $ the AI generated")}</div>
          {events.length ? (
            <div className="divide-y divide-white/[0.06]">{events.map(([t, what, amt], i) => (<div key={i} style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }} className="row-in flex items-center gap-3 px-5 py-3"><span className="grid place-items-center h-8 w-8 rounded-full bg-g-green/15 text-g-green text-sm font-black">＋</span><div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{what}</div><div className="text-[11px] text-g-muted">{t === "now" ? "just now" : `${t} ago`}</div></div><span className="text-sm font-extrabold text-g-green money-glow num">+${amt}</span></div>))}</div>
          ) : (
            <p className="px-5 py-8 text-center text-xs text-g-muted">{tr("Growth events appear here the moment your AI drives revenue this month.")}</p>
          )}
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-2">{tr("Your return")}</div>
          <div className="text-sm text-g-muted">{tr("Gui drove")} <b className="text-g-word">${total.toLocaleString()}</b> {tr("in growth for you this month")}{creditsUsed ? <> · {tr("powered by")} <b className="text-g-word">{creditsUsed.toLocaleString()} {tr("credits")}</b></> : ""}.</div>
          <div className="mt-3 rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] p-3">
            <div className="text-[10px] uppercase tracking-wide text-g-gold font-bold">{tr("Return on credits")}</div>
            <div className={`text-2xl font-extrabold num mt-1 ${roi > 0 ? "text-g-green money-glow" : "text-g-word"}`}>{roi > 0 ? `${roi.toFixed(1)}×` : "—"}</div>
            <div className="text-[11px] text-g-muted mt-0.5">{roi > 0 ? <>Every $1 of credits returned <b className="text-g-word">${roi.toFixed(1)}</b> in growth.</> : "Run Gui this month to see your return."} Pay-as-you-go — you only pay for what Gui does. <b className="text-g-word">Guileo never takes a cut of your revenue.</b></div>
            <button onClick={() => {
              const lines = [["Date", "Growth event", "Amount"], ...events.map(([t, what, amt]) => [t === "now" ? "just now" : `${t} ago`, what, `$${amt}`]), ["", "Total growth Gui drove", `$${total}`], ["", "Credits used", `${creditsUsed}`], ["", "Return on credits", roi > 0 ? `${roi.toFixed(1)}x` : "-"]];
              const csv = lines.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
              const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              const a = document.createElement("a"); a.href = url; a.download = `guileo-growth-statement-${V.label}.csv`; a.click(); URL.revokeObjectURL(url);
              toast("Growth statement downloaded ✓");
            }} className="btn-bright text-sm w-full mt-3 justify-center"><FaDownload size={11} /> Download growth statement</button>
          </div>
          {showChart && <div className="mt-3"><Bars data={chartData} /></div>}
        </Card>
      </div>
    </div>
  );
}

export default GuileoImpact;
