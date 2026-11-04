// Analytics sub-page per channel: intent breakdown, rating distribution, lead stage funnel —
// all computed from real rows (master_leads filtered by source_channel), nothing invented.
import { useMemo } from "react";
import { useNaturaTable } from "../useNaturaTable.js";
import { Card, ErrorNote } from "../Card.jsx";
import { DonutChart, Legend } from "../charts.jsx";
import { CHANNEL_LABEL } from "../metrics.js";
import DateRangeFilter, { useDateRange } from "../DateRangeFilter.jsx";

const RATING_COLOR = { hot: "#e0855f", medium: "#FFC23D", cold: "#948C7B" };
const STAGE_COLOR = {
  new_inquiry: "#3FB4FF", contacted: "#FFC23D", qualified: "#D6C29A",
  booked: "#3E9468", customer: "#2F8A60", lost: "#e0855f",
};

function Breakdown({ title, items, colorMap }) {
  const slices = items.map(([k, v]) => ({ label: k, value: v, color: colorMap[k] || "#948C7B" }));
  const total = items.reduce((s, [, v]) => s + v, 0);
  return (
    <Card>
      <div className="mb-3 text-sm font-extrabold text-g-word">{title}</div>
      {total === 0 ? (
        <div className="py-8 text-center text-[12px] text-g-muted">No data yet.</div>
      ) : (
        <div className="grid place-items-center gap-3">
          <DonutChart slices={slices} size={150} thickness={22} />
          <Legend slices={slices} />
        </div>
      )}
    </Card>
  );
}

export default function ChannelAnalytics({ session, channel }) {
  const { since, until, presetKey, label: rangeLabel, setPresetKey } = useDateRange();
  const { loading, rows, error } = useNaturaTable(session, "master_leads", { since, until });
  const label = CHANNEL_LABEL[channel] || channel;
  const filtered = useMemo(() => rows.filter((l) => l.source_channel === channel), [rows, channel]);

  const breakdowns = useMemo(() => {
    const rating = {}, stage = {}, intent = {};
    for (const l of filtered) {
      if (l.rating) rating[l.rating] = (rating[l.rating] || 0) + 1;
      if (l.stage) stage[l.stage] = (stage[l.stage] || 0) + 1;
      if (l.intent) intent[l.intent] = (intent[l.intent] || 0) + 1;
    }
    const intentSlices = Object.entries(intent).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const intentColors = ["#3FB4FF", "#3E9468", "#FFC23D", "#D6C29A", "#E0855F", "#948C7B"];
    const intentMap = Object.fromEntries(intentSlices.map(([k], i) => [k, intentColors[i % intentColors.length]]));
    return {
      rating: Object.entries(rating),
      stage: Object.entries(stage),
      intent: intentSlices,
      intentMap,
    };
  }, [filtered]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-g-word">{label} Analytics</h1>
        <p className="mt-1 text-[13px] text-g-muted">Lead quality and pipeline breakdown — {rangeLabel.toLowerCase()}</p>
      </div>

      <DateRangeFilter presetKey={presetKey} onChange={setPresetKey} />

      <ErrorNote error={error} label={`${label} analytics`} />

      {loading ? (
        <Card><div className="py-10 text-center text-[12px] text-g-muted">Loading…</div></Card>
      ) : filtered.length === 0 ? (
        <Card><div className="py-10 text-center text-[12px] text-g-muted">No {label.toLowerCase()} leads in this window yet.</div></Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          <Breakdown title="Lead Rating" items={breakdowns.rating} colorMap={RATING_COLOR} />
          <Breakdown title="Pipeline Stage" items={breakdowns.stage} colorMap={STAGE_COLOR} />
          <Breakdown title="Top Intents" items={breakdowns.intent} colorMap={breakdowns.intentMap} />
        </div>
      )}
    </div>
  );
}
