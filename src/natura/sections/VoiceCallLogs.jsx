// Voice Call Logs: replaces the generic chat-thread UI for the voice channel, since voice's real
// unit of activity is a call (recording + transcript + outcome), not a back-and-forth message
// thread. Table of calls (newest first) + a detail panel on row click showing the audio player,
// full transcript (parsed into speaker turns), and the call's classification outcome. Real data
// only — straight from inbound_leads (channel='voice').
import { useMemo, useState } from "react";
import { FaUser, FaPhone, FaPhoneSlash, FaCircleCheck, FaArrowRight, FaArrowLeft, FaCirclePlay, FaUpRightFromSquare } from "react-icons/fa6";
import { useNaturaTable } from "../useNaturaTable.js";
import { Card, ErrorNote, timeAgo } from "../Card.jsx";
import DateRangeFilter, { useDateRange } from "../DateRangeFilter.jsx";

const CALL_FILTERS = [
  { key: "all", label: "All" },
  { key: "hot", label: "Hot" },
  { key: "medium", label: "Medium" },
  { key: "cold", label: "Cold" },
  { key: "new_booking", label: "Booking" },
  { key: "complaint", label: "Complaint" },
  { key: "escalated", label: "Escalated" },
];

const TRANSCRIPT_TURN_RE = /(^|\n)[ \t]*(agent|assistant|lilian|user|customer|caller)\s*:[ \t]*/gi;
const SENTIMENT_TONE = { positive: "text-g-green", negative: "text-red-400", neutral: "text-g-muted" };

function splitVoiceTranscript(text) {
  if (!text) return null;
  const matches = [...text.matchAll(TRANSCRIPT_TURN_RE)];
  if (matches.length === 0) return null;
  const turns = [];
  for (let i = 0; i < matches.length; i++) {
    const role = matches[i][2].toLowerCase();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const turnText = text.slice(start, end).trim();
    if (!turnText) continue;
    const from = (role === "agent" || role === "assistant" || role === "lilian") ? "us" : "them";
    turns.push({ from, text: turnText });
  }
  return turns.length > 0 ? turns : null;
}

function formatDuration(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return "—";
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}m ${s}s`;
}

export default function VoiceCallLogs({ session }) {
  const { since, until, presetKey, setPresetKey } = useDateRange();
  const inbound = useNaturaTable(session, "inbound_leads", { channel: "voice", since, until });
  const customers = useNaturaTable(session, "customers");
  const loading = inbound.loading || customers.loading;
  const error = inbound.error || customers.error;
  const [filter, setFilter] = useState("all");
  const [activeId, setActiveId] = useState(null);

  const calls = useMemo(() => {
    const nameOf = new Map(customers.rows.map((c) => [c.id, c.name || c.phone || "Unknown"]));
    return inbound.rows
      .map((r) => {
        let duration = r.voice_conversation?.[0]?.duration_sec ?? null;
        if (duration == null && Array.isArray(r.voice_conversation)) {
          const withDur = r.voice_conversation.find((e) => e && e.duration_sec != null);
          duration = withDur?.duration_sec ?? null;
        }
        return {
          id: r.id,
          customerId: r.customer_id,
          name: nameOf.get(r.customer_id) || "Unknown",
          phone: customers.rows.find((c) => c.id === r.customer_id)?.phone || "—",
          at: r.timestamp,
          intent: r.intent,
          rating: r.rating,
          escalated: Boolean(r.escalated),
          sentiment: r.voice_sentiment || null,
          leadStatus: r.voice_lead_status || null,
          note: r.voice_note || null,
          recordingUrl: r.recording_url || r.voice_conversation?.[0]?.recording_url || null,
          transcript: r.inbound_text || r.voice_conversation?.[0]?.transcript || "",
          duration,
          answered: Boolean(r.inbound_text),
        };
      })
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }, [inbound.rows, customers.rows]);

  const filtered = useMemo(() => {
    if (filter === "all") return calls;
    if (filter === "escalated") return calls.filter((c) => c.escalated);
    if (["hot", "medium", "cold"].includes(filter)) return calls.filter((c) => c.rating === filter);
    return calls.filter((c) => c.intent === filter);
  }, [calls, filter]);

  const active = filtered.find((c) => c.id === activeId) || filtered[0] || null;
  const activeTurns = active ? splitVoiceTranscript(active.transcript) : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-g-word">Voice Call Logs</h1>
        <p className="mt-1 text-[13px] text-g-muted">Every call Lilian answered, with recording, transcript and outcome</p>
      </div>

      <DateRangeFilter presetKey={presetKey} onChange={setPresetKey} />

      <ErrorNote error={error} label="voice calls" />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {CALL_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${filter === f.key ? "border-g-gold/70 bg-g-creamd text-g-word" : "border-g-line bg-g-creamd/30 text-g-muted hover:border-g-line"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card><div className="py-10 text-center text-[12px] text-g-muted">Loading…</div></Card>
      ) : calls.length === 0 ? (
        <Card><div className="py-10 text-center text-[12px] text-g-muted">No calls yet.</div></Card>
      ) : filtered.length === 0 ? (
        <Card><div className="py-10 text-center text-[12px] text-g-muted">No calls match this filter.</div></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <Card className="!p-0 overflow-hidden">
            <div className="max-h-[640px] overflow-auto scroll-clean">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead className="sticky top-0 bg-g-creamd text-[10px] uppercase tracking-wide text-g-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Name</th>
                    <th className="px-4 py-2.5 font-bold">Number</th>
                    <th className="px-4 py-2.5 font-bold">Duration</th>
                    <th className="px-4 py-2.5 font-bold">Rating</th>
                    <th className="px-4 py-2.5 font-bold">Status</th>
                    <th className="px-4 py-2.5 font-bold">Recording</th>
                    <th className="px-4 py-2.5 font-bold">Date &amp; Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className={`cursor-pointer border-t border-g-line transition ${active?.id === c.id ? "bg-g-cream" : "hover:bg-white/[0.03]"}`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.07] text-g-muted"><FaUser size={11} /></span>
                          <span className="font-bold text-g-word">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-g-muted">{c.phone}</td>
                      <td className="px-4 py-2.5 text-g-muted">{formatDuration(c.duration)}</td>
                      <td className="px-4 py-2.5">
                        {c.rating && (
                          <span className={`rounded-full border border-g-line px-2 py-0.5 text-[10px] font-bold capitalize ${c.rating === "hot" ? "text-red-400" : c.rating === "medium" ? "text-g-gold" : "text-g-muted"}`}>
                            {c.rating}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`flex items-center gap-1.5 text-[11px] font-bold ${c.answered ? "text-g-green" : "text-red-400"}`}>
                          {c.answered ? <FaCircleCheck size={10} /> : <FaPhoneSlash size={10} />}
                          {c.answered ? "Answered" : "No Answer"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {c.recordingUrl ? (
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-g-gold"><FaCirclePlay size={11} /> Available</span>
                        ) : (
                          <span className="text-[11px] text-g-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-g-muted">{timeAgo(c.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 content-start">
            {active ? (
              <>
                <Card>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-extrabold text-g-word">{active.name}</div>
                      <div className="text-[11px] text-g-muted">{active.phone} · {timeAgo(active.at)}</div>
                    </div>
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-g-muted"><FaPhone size={13} /></span>
                  </div>
                  {active.recordingUrl ? (
                    <div key={active.id} className="mt-3 flex items-center gap-2 rounded-xl2 border border-g-line bg-g-cream/50 px-2 py-2">
                      {/* ElevenLabs recordings are served as .mpga - not a MIME type browsers can
                          infer from the extension alone, so a bare `src` leaves the player stuck
                          at 0:00/0:00 with a dead seek bar in Chrome/Firefox. Explicit <source>
                          tags with a real audio MIME type (mpga is MPEG audio, same family as
                          mp3) let the browser actually probe and load it. */}
                      <audio controls preload="metadata" className="h-9 flex-1 min-w-0">
                        <source src={active.recordingUrl} type="audio/mpeg" />
                        <source src={active.recordingUrl} type="audio/mp4" />
                        Your browser does not support the audio element.
                      </audio>
                      <a
                        href={active.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open recording in new tab"
                        className="shrink-0 grid h-7 w-7 place-items-center rounded-full text-g-muted hover:text-g-gold hover:bg-white/[0.06]"
                      >
                        <FaUpRightFromSquare size={10} />
                      </a>
                    </div>
                  ) : (
                    <div className="mt-3 text-[12px] text-g-muted">No recording available for this call.</div>
                  )}
                </Card>

                {(active.leadStatus || active.sentiment || active.note) && (
                  <Card className="!p-0 overflow-hidden">
                    <div className="border-b border-g-line bg-white/[0.02] px-4 py-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-g-muted">Lead Status &amp; Sentiment</span>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {active.leadStatus && <span className="rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold capitalize text-g-word">{active.leadStatus}</span>}
                        {active.sentiment && <span className={`rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold capitalize ${SENTIMENT_TONE[active.sentiment] || "text-g-word"}`}>{active.sentiment}</span>}
                      </div>
                      {active.note && <p className="mt-3 text-[12.5px] leading-relaxed text-g-muted">{active.note}</p>}
                    </div>
                  </Card>
                )}

                <Card className="max-h-[360px] overflow-y-auto scroll-clean">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-g-muted">Transcript</div>
                  {activeTurns ? (
                    <div className="grid gap-3">
                      {activeTurns.map((t, i) => (
                        <div key={i} className={`flex ${t.from === "us" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] rounded-xl2 px-3 py-2 text-[12.5px] ${t.from === "us" ? "bg-g-green/15 text-g-word" : "bg-white/[0.05] text-g-word"}`}>
                            <div className="flex items-center gap-1.5 text-[10px] text-g-muted">
                              {t.from === "us" ? <FaArrowRight size={8} /> : <FaArrowLeft size={8} />}
                              {t.from === "us" ? "Lilian" : active.name}
                            </div>
                            <div className="mt-1">{t.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-[12px] text-g-muted">No transcript available.</div>
                  )}
                </Card>
              </>
            ) : (
              <Card><div className="py-10 text-center text-[12px] text-g-muted">Select a call</div></Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
