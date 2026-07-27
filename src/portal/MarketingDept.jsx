/* Split out of Portal.jsx (performance): MarketingDept tab view — code moved verbatim. */
import { useState, useCallback, useEffect } from "react";
import { fetchCrmCampaigns, toast } from "../lib/portalApi.js";
import { SectionSkeleton, RetryState, tr, DeptTabs, Card, Empty } from "../pages/Portal.jsx";

function MarketingDept({ V, onNav, email = "", dataKey = "" }) {
  const demo = !dataKey;
  const [campaigns, setCampaigns] = useState([]);
  const [state, setState] = useState(demo ? "ok" : "loading");
  const load = useCallback(() => {
    setState("loading");
    fetchCrmCampaigns(dataKey, email).then((d) => { setCampaigns(d || []); setState("ok"); }).catch(() => setState("err"));
  }, [dataKey, email]);
  useEffect(() => {
    if (demo) {
      setCampaigns([
        { id: "c1", name: "Win back lapsed clients", channel: "sms", segment: "lapsed", status: "sent", audience_count: 128, sent_count: 128 },
        { id: "c2", name: "VIP early access", channel: "whatsapp", segment: "vip", status: "scheduled", audience_count: 18, sent_count: 0 },
        { id: "c3", name: "New-lead nurture", channel: "sms", segment: "lead", status: "draft", audience_count: 42, sent_count: 0 },
      ]); setState("ok"); return;
    }
    load();
  }, [demo, dataKey, email, load]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === "loading") return <SectionSkeleton />;
  if (state === "err") return <RetryState onRetry={load} />;
  const SEGMENTS = [["all", tr("Everyone")], ["lead", tr("Leads")], ["customer", tr("Customers")], ["vip", tr("VIPs")], ["lapsed", tr("Lapsed")], ["at_risk", tr("At risk")]];
  const chColor = (c) => c === "whatsapp" ? "#25D366" : c === "email" ? "#D6C29A" : "#3E9468";
  const stColor = (s) => s === "sent" ? "#3E9468" : s === "scheduled" ? "#D6C29A" : "#9AA0A6";
  return (
    <div className="space-y-4 stagger">
      <DeptTabs cur="marketing" onNav={onNav} items={[["marketing", "Marketing"], ["campaigns", "Campaigns"], ["audiences", "Ad Audiences"]]} />
      <Card className="border-g-gold/25 bg-g-gold/[0.05]">
        <div className="text-sm font-extrabold text-g-word">📣 {tr("Reach the right segment, in one tap")}</div>
        <div className="text-xs text-g-muted mt-0.5">{tr("Pick an audience — Gui drafts and sends across SMS, WhatsApp and email.")}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SEGMENTS.map(([k, label]) => (
            <button key={k} onClick={() => toast(`${tr("Campaign drafted for")} "${label}" ✓`)} className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[12.5px] text-g-ink hover:border-g-gold/40 hover:text-g-word transition">{label}</button>
          ))}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Campaigns")}</span></div>
        <div className="divide-y divide-white/[0.06]">
          {campaigns.length ? campaigns.map((c, i) => (
            <div key={c.id || i} className="flex items-center gap-3 px-5 py-3">
              <span className="grid place-items-center h-9 w-9 rounded-full text-white text-[11px] font-black shrink-0" style={{ background: chColor(c.channel) }}>{(c.channel || "sms").slice(0, 2).toUpperCase()}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name}</div><div className="text-[11px] text-g-muted truncate">{tr("Segment")}: {c.segment} · {c.audience_count || 0} {tr("contacts")}</div></div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: stColor(c.status) + "22", color: stColor(c.status) }}>{tr(c.status || "draft")}</span>
            </div>
          )) : <Empty icon="📣" text={demo ? tr("Launch a campaign to a segment and it shows up here with its audience and status.") : tr("No campaigns yet — pick a segment above to launch your first.")} />}
        </div>
      </Card>
    </div>
  );
}

export default MarketingDept;
