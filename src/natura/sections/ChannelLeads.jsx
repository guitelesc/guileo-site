// Leads sub-page per channel: master_leads filtered to this channel's source_channel.
import { useMemo } from "react";
import { useNaturaTable } from "../useNaturaTable.js";
import { Card, ErrorNote, timeAgo } from "../Card.jsx";
import { CHANNEL_LABEL } from "../metrics.js";
import DateRangeFilter, { useDateRange } from "../DateRangeFilter.jsx";

export default function ChannelLeads({ session, channel }) {
  const { since, until, presetKey, label: rangeLabel, setPresetKey } = useDateRange();
  const { loading, rows, error } = useNaturaTable(session, "master_leads", { since, until });
  const label = CHANNEL_LABEL[channel] || channel;
  const filtered = useMemo(() => rows.filter((l) => l.source_channel === channel), [rows, channel]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-g-word">{label} Leads</h1>
        <p className="mt-1 text-[13px] text-g-muted">Leads sourced from {label} — {rangeLabel.toLowerCase()}</p>
      </div>

      <DateRangeFilter presetKey={presetKey} onChange={setPresetKey} />

      <ErrorNote error={error} label={`${label} leads`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading && <Card><div className="text-[12px] text-g-muted">Loading…</div></Card>}
        {!loading && filtered.length === 0 && !error && <Card><div className="text-[12px] text-g-muted">No {label.toLowerCase()} leads yet.</div></Card>}
        {filtered.map((l) => (
          <Card key={l.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full border border-g-line px-2 py-0.5 text-[10px] text-g-ink">{l.stage}</span>
              {l.rating && (
                <span className="text-[10px] font-bold" style={{ color: l.rating === "hot" ? "#e0855f" : l.rating === "medium" ? "#FFC23D" : "#948C7B" }}>{l.rating}</span>
              )}
            </div>
            <div className="mt-2 text-[13px] font-bold text-g-word">{l.service_interest || l.intent || "(no detail)"}</div>
            {l.summary && <div className="mt-1 text-[12px] text-g-muted line-clamp-2">{l.summary}</div>}
            <div className="mt-2 text-[10px] text-g-muted">{timeAgo(l.updated_at)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
