import { useMemo } from "react";
import { FaPaperPlane, FaInbox, FaCircleCheck, FaCircleExclamation, FaComments } from "react-icons/fa6";
import { useNaturaTable } from "../useNaturaTable.js";
import { Card, Kpi, ErrorNote } from "../Card.jsx";
import { LineChart, DonutChart, Legend } from "../charts.jsx";
import { dailySeries, replyRate, sentimentCounts, CHANNEL_LABEL, SENTIMENT_COLUMN_CHANNEL } from "../metrics.js";
import DateRangeFilter, { useDateRange } from "../DateRangeFilter.jsx";

const CONVERSATION_COLUMN = {
  whatsapp: "whatsapp_conversation", sms: "sms_conversation", voice: "voice_conversation",
  email: "email_conversation", instagram: "instagram_conversation", facebook: "facebook_conversation",
};

export default function ChannelDashboard({ session, channel }) {
  const { since, until, presetKey, label: rangeLabel, setPresetKey } = useDateRange();
  const WINDOW_DAYS = useMemo(() => (since ? Math.ceil((Date.now() - new Date(since).getTime()) / 86400000) : 90), [since]);
  const outbound = useNaturaTable(session, "outbound_leads", { channel, since, until });
  // inbound_leads: fetched the same simple way voice fetches its own rows (date filter,
  // server-side) — EXCEPT the channel filter is dropped, because a voice call's SMS/email
  // confirmation lives on that call's own row (channel='voice'), not a separate channel='sms'/
  // 'email' row. A row counts for this page if it's this channel's own row, or if it carries
  // data in this channel's *_conversation column.
  const inboundAll = useNaturaTable(session, "inbound_leads", { since, until });
  const loading = outbound.loading || inboundAll.loading;
  const error = outbound.error || inboundAll.error;

  const conversationField = CONVERSATION_COLUMN[channel];
  const inbound = useMemo(() => ({
    rows: inboundAll.rows.filter((r) => r.channel === channel || (conversationField && Array.isArray(r[conversationField]) && r[conversationField].length > 0)),
  }), [inboundAll.rows, channel, conversationField]);

  // Voice's primary activity is INBOUND calls (logged to inbound_leads) — outbound_leads for
  // voice only holds the sparse confirmation SMS/email/follow-up rows written after a call, not
  // the real call volume. Every other channel's primary activity is outbound sends, so they stay
  // on the original outbound_leads-driven computation.
  const isVoice = channel === "voice";

  const stats = useMemo(() => {
    const sentimentField = SENTIMENT_COLUMN_CHANNEL[channel] || channel;

    if (isVoice) {
      const calls = inbound.rows;
      const uniqueLeads = new Set(calls.map((r) => r.customer_id).filter(Boolean)).size;
      const bookedCalls = calls.filter((r) => r.intent === "new_booking" || r.rating === "hot");
      const sentiment = sentimentCounts(calls, sentimentField);
      const callsSeries = dailySeries(calls, "timestamp", WINDOW_DAYS);
      const funnel = [
        { label: "Calls", value: calls.length, color: "#3FB4FF" },
        { label: "Hot/Booking Intent", value: bookedCalls.length, color: "#3E9468" },
      ];
      return {
        uniqueLeads, sent: calls.length, replies: bookedCalls.length,
        rate: replyRate(calls.length, bookedCalls.length),
        sentiment, activity: callsSeries, sentSeries: callsSeries, repliedSeries: dailySeries(bookedCalls, "timestamp", WINDOW_DAYS), funnel,
        sentLabel: "Total Calls", repliesLabel: "Hot / Booking Intent", rateSub: "of calls rated hot or booking-intent",
      };
    }

    // Real sent/replied messages for this channel come from two places now: outbound_leads rows
    // written directly by this channel's own workflow, PLUS synthetic entries extracted from any
    // inbound_leads row (of any channel, typically voice) whose *_conversation column holds this
    // channel's confirmation. Both are merged into one list so KPIs/charts count every real send.
    const conversationEntries = [];
    if (conversationField) {
      for (const r of inbound.rows) {
        const conv = r[conversationField];
        if (!Array.isArray(conv)) continue;
        for (const entry of conv) {
          if (!entry || entry.event === "status_callback") continue;
          conversationEntries.push({
            direction: entry.direction || "outbound",
            created_at: entry.timestamp || r.timestamp,
            customer_id: r.customer_id,
            status: entry.status || "sent",
          });
        }
      }
    }
    const allOutboundRows = [...outbound.rows, ...conversationEntries];

    const sent = allOutboundRows.filter((r) => r.direction === "outbound");
    const replies = allOutboundRows.filter((r) => r.direction === "inbound");
    const uniqueLeads = new Set(allOutboundRows.map((r) => r.customer_id).filter(Boolean)).size;
    const sentiment = sentimentCounts([...inbound.rows, ...replies], sentimentField);
    const activity = dailySeries(allOutboundRows, "created_at", WINDOW_DAYS);
    const sentSeries = dailySeries(sent, "created_at", WINDOW_DAYS);
    const repliedSeries = dailySeries(replies, "created_at", WINDOW_DAYS);
    const funnel = [
      { label: "Sent", value: sent.length, color: "#3FB4FF" },
      { label: "Replied", value: replies.length, color: "#3E9468" },
    ];
    return {
      uniqueLeads, sent: sent.length, replies: replies.length,
      rate: replyRate(sent.length, replies.length),
      sentiment, activity, sentSeries, repliedSeries, funnel,
      sentLabel: "Total Messages Sent", repliesLabel: "Total Replies", rateSub: `${replyRate(sent.length, replies.length)}% reply rate`,
    };
  }, [outbound.rows, inbound.rows, channel, isVoice, conversationField]);

  const label = CHANNEL_LABEL[channel] || channel;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-g-word">{label} Overview</h1>
        <p className="mt-1 text-[13px] text-g-muted">{rangeLabel}</p>
      </div>

      <DateRangeFilter presetKey={presetKey} onChange={setPresetKey} />

      <ErrorNote error={error} label={`${label} data`} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Unique Leads Contacted" value={loading ? "…" : stats.uniqueLeads} Icon={FaComments} />
        <Kpi label={stats.sentLabel || "Total Messages Sent"} value={loading ? "…" : stats.sent} Icon={FaPaperPlane} />
        <Kpi label={stats.repliesLabel || "Total Replies"} value={loading ? "…" : stats.replies} sub={loading ? "" : stats.rateSub} Icon={FaInbox} tone="green" />
        <Kpi label="Positive Sentiment" value={loading ? "…" : stats.sentiment.positive} sub={isVoice ? "Calls that sounded positive" : "Replies that sounded interested"} Icon={FaCircleCheck} tone="green" />
        <Kpi label="Negative Sentiment" value={loading ? "…" : stats.sentiment.negative} sub={isVoice ? "Calls that sounded negative" : "Replies that sounded uninterested"} Icon={FaCircleExclamation} tone="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-extrabold text-g-word">Activity Trend</div>
            <div className="flex items-center gap-3 text-[11px] text-g-muted">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#3FB4FF" }} /> {isVoice ? "Calls" : "Sent"}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#3E9468" }} /> {isVoice ? "Hot / Booking" : "Replied"}</span>
            </div>
          </div>
          {loading ? (
            <div className="py-10 text-center text-[12px] text-g-muted">Loading…</div>
          ) : (
            <OverlaidLines sent={stats.sentSeries} replied={stats.repliedSeries} />
          )}
        </Card>

        <Card>
          <div className="mb-3 text-sm font-extrabold text-g-word">Conversion Funnel</div>
          {loading ? (
            <div className="py-10 text-center text-[12px] text-g-muted">Loading…</div>
          ) : stats.sent === 0 ? (
            <div className="py-10 text-center text-[12px] text-g-muted">No activity in this window yet.</div>
          ) : (
            <div className="grid place-items-center gap-3">
              <DonutChart slices={stats.funnel} />
              <Legend slices={stats.funnel} />
              <div className="flex gap-6 text-center">
                <div><div className="text-lg font-extrabold text-g-word">{stats.sent}</div><div className="text-[10px] uppercase text-g-muted">{isVoice ? "Total Calls" : "Total Messages"}</div></div>
                <div><div className="text-lg font-extrabold text-g-word">{stats.replies}</div><div className="text-[10px] uppercase text-g-muted">{isVoice ? "Hot / Booking" : "Replies"}</div></div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// Two-series mini line overlay (sent vs replied) reusing the single-series LineChart's SVG
// coordinate math would require lifting it out; simplest readable option here is one inline
// SVG with both paths drawn against a shared scale.
function OverlaidLines({ sent, replied }) {
  const W = 760, H = 220, padL = 36, padR = 12, padT = 12, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(1, ...sent.map((p) => p.value), ...replied.map((p) => p.value));
  const n = sent.length;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const x = (i) => padL + i * step;
  const y = (v) => padT + innerH - (v / max) * innerH;
  const path = (pts) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");
  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((max / ticks) * i));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {tickVals.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-g-line" strokeDasharray="3 4" />
          <text x={padL - 8} y={y(v) + 3} textAnchor="end" fontSize="10" className="fill-g-muted">{v}</text>
        </g>
      ))}
      <path d={path(sent)} fill="none" stroke="#3FB4FF" strokeWidth="2" />
      <path d={path(replied)} fill="none" stroke="#3E9468" strokeWidth="2" />
      {sent.map((p, i) => (
        (i === 0 || i === n - 1 || i % Math.ceil(n / 7) === 0) && (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" className="fill-g-muted">{p.label}</text>
        )
      ))}
      <g transform={`translate(${padL}, ${H - 8})`} />
    </svg>
  );
}
