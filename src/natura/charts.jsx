// Small inline-SVG charts for the Natura channels dashboard — no charting library dependency.
// Both components are purely presentational: callers compute the data, these just draw it.
export function LineChart({ points, color = "#3FB4FF", height = 220 }) {
  // points: [{ label, value }]. Renders a filled area + line, y-axis ticks, x-axis labels.
  const W = 760;
  const H = height;
  const padL = 36, padR = 12, padT = 12, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const x = (i) => padL + i * step;
  const y = (v) => padT + innerH - (v / max) * innerH;
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1)} ${padT + innerH} L ${x(0)} ${padT + innerH} Z`;
  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((max / ticks) * i));
  const gid = "lc-" + color.replace("#", "");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {tickVals.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-g-line" strokeDasharray="3 4" />
          <text x={padL - 8} y={y(v) + 3} textAnchor="end" fontSize="10" className="fill-g-muted">{v}</text>
        </g>
      ))}
      {points.length > 0 && <path d={areaPath} fill={`url(#${gid})`} />}
      {points.length > 0 && <path d={linePath} fill="none" stroke={color} strokeWidth="2" />}
      {points.map((p, i) => (
        (i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 7) === 0) && (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" className="fill-g-muted">{p.label}</text>
        )
      ))}
    </svg>
  );
}

export function DonutChart({ slices, size = 180, thickness = 28 }) {
  // slices: [{ label, value, color }]. Renders a donut; empty state shows a dim full ring.
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" className="text-g-line" strokeWidth={thickness} />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {slices.filter((s) => s.value > 0).map((s, i) => {
          const frac = s.value / total;
          const dash = frac * circumference;
          const circle = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return circle;
        })}
      </g>
    </svg>
  );
}

export function Legend({ slices }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {slices.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5 text-[12px] text-g-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label}
        </span>
      ))}
    </div>
  );
}
