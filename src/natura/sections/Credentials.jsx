// Credentials sub-page: shows which channels have real activity on record (proof of a working
// connection), not editable API-key fields — those live in Cloudflare env vars server-side,
// per the project's "no secrets in code/UI" house rule (README-FOR-LEE.md #6).
import { useMemo } from "react";
import { FaCircleCheck, FaCircleXmark } from "react-icons/fa6";
import { useNaturaTable } from "../useNaturaTable.js";
import { Card, ErrorNote, timeAgo } from "../Card.jsx";
import { CHANNEL_LABEL, CHANNEL_COLOR } from "../metrics.js";

export default function Credentials({ session }) {
  const { loading, rows, error } = useNaturaTable(session, "outbound_leads");

  const perChannel = useMemo(() => {
    const last = {};
    for (const r of rows) {
      if (!last[r.channel] || new Date(r.created_at) > new Date(last[r.channel])) last[r.channel] = r.created_at;
    }
    return Object.keys(CHANNEL_LABEL).map((key) => ({ key, label: CHANNEL_LABEL[key], color: CHANNEL_COLOR[key], last: last[key] || null }));
  }, [rows]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-g-word">Credentials</h1>
        <p className="mt-1 text-[13px] text-g-muted">Connection status per channel, based on real send activity</p>
      </div>

      <ErrorNote error={error} label="credential status" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading && <Card><div className="text-[12px] text-g-muted">Loading…</div></Card>}
        {!loading && perChannel.map((c) => (
          <Card key={c.key}>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.07]" style={{ color: c.color }}>
                {c.last ? <FaCircleCheck size={16} /> : <FaCircleXmark size={16} />}
              </span>
              <div>
                <div className="text-sm font-extrabold text-g-word">{c.label}</div>
                <div className="text-[11px] text-g-muted">{c.last ? `Last send ${timeAgo(c.last)}` : "No activity on record"}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
