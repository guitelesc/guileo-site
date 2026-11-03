// Shared date-range filter for every Natura dashboard page — defaults to Last 7 Days everywhere.
// Returns { since, until, days, label } where since/until are ISO strings (or null for "All
// time") ready to pass straight into useNaturaTable's { since, until } params, which the
// /api/natura-data route already supports server-side (gte/lte on each table's real date column).
import { useMemo, useState } from "react";
import { FaCalendarDays } from "react-icons/fa6";

export const PRESETS = [
  { key: "7d", label: "Last 7 Days", days: 7 },
  { key: "14d", label: "Last 14 Days", days: 14 },
  { key: "30d", label: "Last 30 Days", days: 30 },
  { key: "90d", label: "Last 90 Days", days: 90 },
  { key: "all", label: "All Time", days: null },
];
export const DEFAULT_PRESET_KEY = "7d";

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Hook: owns the selected preset, returns the resolved {since, until} plus the preset key/setter.
export function useDateRange(defaultKey = DEFAULT_PRESET_KEY) {
  const [presetKey, setPresetKey] = useState(defaultKey);
  const range = useMemo(() => {
    const preset = PRESETS.find((p) => p.key === presetKey) || PRESETS[0];
    return {
      presetKey,
      label: preset.label,
      since: preset.days ? daysAgoISO(preset.days) : null,
      until: null,
    };
  }, [presetKey]);
  return { ...range, setPresetKey };
}

// Reusable filter-chip row — same visual language as the status filter chips used elsewhere
// (ChannelChat.jsx, VoiceCallLogs.jsx).
export default function DateRangeFilter({ presetKey, onChange }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 flex items-center gap-1.5 text-[11px] font-bold text-g-muted">
        <FaCalendarDays size={11} /> Date Range
      </span>
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${presetKey === p.key ? "border-g-gold/70 bg-g-creamd text-g-word" : "border-g-line bg-g-creamd/30 text-g-muted hover:border-g-line"}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
