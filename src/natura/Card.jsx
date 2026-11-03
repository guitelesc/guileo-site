export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl2 border border-g-line bg-g-creamd/60 p-4 shadow-soft ${className}`}>
      {children}
    </div>
  );
}

export function Kpi({ label, value, sub, Icon, tone }) {
  const toneColor = tone === "green" ? "#3E9468" : tone === "red" ? "#e0855f" : tone === "gold" ? "#FFC23D" : null;
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{label}</span>
        {Icon && <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-g-muted"><Icon size={13} /></span>}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-g-word">{value}</div>
      {sub && <div className="mt-1 text-[11px]" style={{ color: toneColor || undefined }}>{!toneColor && <span className="text-g-muted">{sub}</span>}{toneColor && sub}</div>}
    </Card>
  );
}

export function ErrorNote({ error, label }) {
  if (!error) return null;
  return (
    <Card className="mb-4">
      <div className="flex items-center gap-2 text-[13px] text-[#e0855f]">
        Couldn't read {label} — {error}
      </div>
    </Card>
  );
}

export function timeAgo(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
