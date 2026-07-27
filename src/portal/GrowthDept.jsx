/* Split out of Portal.jsx (performance): GrowthDept tab view — code moved verbatim. */
import { useState, useCallback, useEffect } from "react";
import { fetchCRM, toast } from "../lib/portalApi.js";
import { genCustomers, SectionSkeleton, RetryState, tr, DeptTabs, MiniStats, Card, Empty } from "../pages/Portal.jsx";

function GrowthDept({ V, onNav, email = "", dataKey = "" }) {
  const demo = !dataKey;
  const [contacts, setContacts] = useState([]);
  const [state, setState] = useState(demo ? "ok" : "loading");
  const load = useCallback(() => {
    setState("loading");
    fetchCRM(dataKey, email).then((d) => { setContacts(d.contacts || []); setState("ok"); }).catch(() => setState("err"));
  }, [dataKey, email]);
  useEffect(() => {
    if (demo) {
      const sc = V.customers || genCustomers(V);
      setContacts(sc.map((c, i) => ({ full_name: c.name, ltv_cents: Math.round((c.spent || 0) * 100), lifecycle: i % 3 === 2 ? "lapsed" : i === 0 ? "vip" : "customer", churn_risk: i % 4 === 3 ? 72 : i % 3 === 2 ? 58 : 14 }))); setState("ok"); return;
    }
    load();
  }, [demo, dataKey, email, load]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === "loading") return <SectionSkeleton />;
  if (state === "err") return <RetryState onRetry={load} />;
  const fmtMoney = (c) => `$${Math.round((c || 0) / 100).toLocaleString()}`;
  const atRisk = contacts.filter((c) => (c.churn_risk || 0) >= 50 || ["lapsed", "churned"].includes(c.lifecycle));
  const recoverable = atRisk.reduce((s, c) => s + (c.ltv_cents || 0), 0);
  const riskCls = (r) => r >= 60 ? "bg-red-500/15 text-red-300" : r >= 35 ? "bg-g-gold/15 text-g-gold" : "bg-g-green/15 text-g-green";
  const reactivateAll = async () => {
    if (!dataKey) { toast(tr("Connect your account to reactivate for real.")); return; }
    toast(`${tr("Gui is reactivating")} ${atRisk.length} ${tr("cold contacts")}…`);
    try {
      const r = await fetch("/api/reactivate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: dataKey, email }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) toast(`${tr("Gui reached")} ${(d.sms || 0) + (d.calls || 0)} ${tr("customers")} ✓`);
      else toast(tr("Couldn't reach the reactivation engine — try again."));
    } catch { toast(tr("Couldn't reach the reactivation engine — try again.")); }
  };
  return (
    <div className="space-y-4 stagger">
      <DeptTabs cur="retention" onNav={onNav} items={[["retention", "Growth & Retention"], ["followups", "Follow-ups"], ["recurring", "Recurring"], ["loyalty", "Loyalty"], ["reputation", "Reputation"], ["waitlist", "Waitlist"]]} />
      <MiniStats items={[[tr("At risk"), `${atRisk.length}`, atRisk.length ? "bad" : undefined], [tr("Recoverable value"), fmtMoney(recoverable), "good"], [tr("Total contacts"), `${contacts.length}`]]} />
      <Card className="border-g-gold/25 bg-g-gold/[0.05]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word">🔄 {tr("Win back who's slipping away")}</div><div className="text-xs text-g-muted mt-0.5">{tr("Gui reaches every lapsing customer with a personal nudge — one tap.")}</div></div>
          {atRisk.length > 0 && <button onClick={reactivateAll} className="btn-bright text-sm whitespace-nowrap">{tr("Reactivate all")} ({atRisk.length})</button>}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Slipping away")}</span></div>
        <div className="divide-y divide-white/[0.06]">
          {atRisk.length ? atRisk.slice(0, 40).map((c, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className={`grid place-items-center h-9 w-9 rounded-full text-[12px] font-black shrink-0 ${riskCls(c.churn_risk || 0)}`}>{c.churn_risk || 0}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.full_name || tr("Unknown")}</div><div className="text-[11px] text-g-muted truncate">{["lapsed", "churned"].includes(c.lifecycle) ? tr("lapsed") : tr("at churn risk")} · {fmtMoney(c.ltv_cents)} LTV</div></div>
              <button onClick={() => toast(`${tr("Gui is reaching out to")} ${c.full_name || ""} ✓`)} className="btn-ghost text-[12px] shrink-0">{tr("Win back")}</button>
            </div>
          )) : <Empty icon="🎉" text={demo ? tr("When a loyal customer starts slipping, Gui flags them here and wins them back automatically.") : tr("Nobody's slipping right now — Gui keeps watching and flags at-risk customers here.")} />}
        </div>
      </Card>
    </div>
  );
}

export default GrowthDept;
