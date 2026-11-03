// Chat sub-page: picks a customer who has activity on this channel, shows their
// inbound+outbound thread chronologically. Real data only — pulled straight from
// inbound_leads.inbound_text/reply_text and outbound_leads.message_text/status.
import { useMemo, useState } from "react";
import { FaUser, FaArrowRight, FaArrowLeft, FaEnvelopeOpenText, FaXmark, FaUpRightFromSquare } from "react-icons/fa6";
import { useNaturaTable } from "../useNaturaTable.js";
import { Card, ErrorNote, timeAgo } from "../Card.jsx";
import { CHANNEL_LABEL, SENTIMENT_COLUMN_CHANNEL } from "../metrics.js";
import DateRangeFilter, { useDateRange } from "../DateRangeFilter.jsx";

const SENTIMENT_TONE = { positive: "text-g-green", negative: "text-red-400", neutral: "text-g-muted" };
// Per-message send/delivery status badge tone — shown on each outbound bubble so it's visible
// at a glance whether that specific message actually went out, not just the thread overall.
const MSG_STATUS_TONE = {
  sent: "text-g-muted", queued: "text-g-muted", delivered: "text-g-green", read: "text-g-green",
  opened: "text-g-green", booked: "text-g-green", replied: "text-g-green",
  failed: "text-red-400", opted_out: "text-red-400",
};

// outbound_leads.status is exactly this set — see supabase/001_schema.sql. "no_reply" is a
// derived filter (sent/delivered/opened but no inbound reply recorded yet), not a literal
// column value, since that distinction is genuinely useful and the real data supports it.
const STATUS_FILTERS = [
  { key: "all",       label: "All" },
  { key: "queued",    label: "Queued" },
  { key: "sent",      label: "Sent" },
  { key: "delivered", label: "Delivered" },
  { key: "opened",    label: "Opened" },
  { key: "replied",   label: "Replied" },
  { key: "no_reply",  label: "No Reply" },
  { key: "booked",    label: "Booked" },
  { key: "failed",    label: "Failed" },
  { key: "opted_out", label: "Opted Out" },
];
// Rank used to pick the "best" status a thread has reached, so a thread with both a 'sent' and
// a later 'replied' outbound row is correctly classified as replied, not queued.
const STATUS_RANK = ["failed", "opted_out", "queued", "sent", "delivered", "opened", "replied", "booked"];

// Voice's inbound_text is the ENTIRE call transcript as one string ("agent: ...\nuser: ...\n
// agent: ..."), not a single message — unlike every other channel, where inbound_text is one
// real customer message. Split it into individual turns so each renders as its own chat bubble
// instead of one unreadable wall of text. "agent"/"assistant"/"lilian" -> us, everything else
// (usually "user") -> them. A transcript that doesn't match the "role: text" pattern at all
// (unexpected format) falls back to one bubble with the raw text, same as before.
const TRANSCRIPT_TURN_RE = /(^|\n)[ \t]*(agent|assistant|lilian|user|customer|caller)\s*:[ \t]*/gi;
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

// Each channel's *_conversation jsonb column is the real per-message log written by its n8n
// workflow (confirmed against live node SQL) — a richer, ordered source than inbound_text/
// reply_text/message_text, and the only one that correctly interleaves inbound+outbound+status
// events in true send order for channels like WhatsApp and email. Entry shapes differ per
// channel (confirmed from each workflow's own write queries), so each gets its own mapper into
// a common {at, from, text} shape; a 'status_callback'/'event' entry (delivery receipts, not a
// real message) is skipped rather than rendered as a chat bubble.
const CONVERSATION_COLUMN = {
  whatsapp: "whatsapp_conversation",
  sms: "sms_conversation",
  voice: "voice_conversation",
  email: "email_conversation",
  instagram: "instagram_conversation",
  facebook: "facebook_conversation",
};

// status_callback entries are delivery/read receipts (WhatsApp's wamid status events) rather
// than a message on their own — but they carry the real delivered/read/failed outcome for an
// earlier outbound message, which is exactly what "what's sent or not" needs. Collected
// separately per thread and matched back onto the matching outbound bubble by wamid instead of
// being dropped or rendered as their own fake chat turn.
function isStatusCallback(entry) {
  return Boolean(entry) && typeof entry === "object" && entry.event === "status_callback";
}

function mapConversationEntry(channel, entry) {
  if (!entry || typeof entry !== "object") return null;
  if (isStatusCallback(entry)) return null;
  const at = entry.timestamp || entry.recorded_at || entry.created_at || null;
  if (channel === "whatsapp") {
    if (!entry.text) return null;
    return { at, from: entry.direction === "outbound" ? "us" : "them", text: entry.text, status: entry.status || null, wamid: entry.wamid || null };
  }
  if (channel === "sms") {
    if (!entry.body) return null;
    return { at, from: entry.direction === "outbound" ? "us" : "them", text: entry.body, status: entry.status || null, messageSid: entry.message_sid || null };
  }
  if (channel === "voice") {
    // One voice_conversation entry holds a whole call's transcript as one string, not a
    // per-turn log — split it the same way splitVoiceTranscript does for inbound_text.
    const turns = splitVoiceTranscript(entry.transcript);
    return turns ? turns.map((t) => ({ at, from: t.from, text: t.text })) : null;
  }
  // email/instagram/facebook: fall back to generic direction/text (or body/message) fields.
  // body_html is a full rendered HTML email template (from n8n's own confirmation-email node,
  // never user input) - flag it so the bubble renders it as markup instead of a wall of raw tags.
  const isHtml = !entry.text && !entry.body && Boolean(entry.body_html);
  const text = entry.text || entry.body || entry.body_html || entry.message || null;
  if (!text) return null;
  return { at, from: entry.direction === "outbound" ? "us" : "them", text, status: entry.status || null, isHtml, subject: entry.subject || null };
}

// Flattens a channel's *_conversation column into ordered {at, from, text} turns. Returns null
// (not []) when the column is absent/empty so callers can fall back to inbound_text/reply_text/
// message_text for rows written before this column existed.
function parseConversationColumn(channel, rawConversation) {
  if (!Array.isArray(rawConversation) || rawConversation.length === 0) return null;
  const turns = [];
  // WhatsApp's status_callback entries report delivered/read/failed for an earlier outbound
  // message by wamid, after that message's own turn was already pushed — collect them so the
  // latest status can overwrite the turn's initial status rather than being lost.
  const latestStatusByWamid = new Map();
  for (const entry of rawConversation) {
    if (isStatusCallback(entry) && entry.wamid) latestStatusByWamid.set(entry.wamid, entry.status || null);
  }
  for (const entry of rawConversation) {
    const mapped = mapConversationEntry(channel, entry);
    if (!mapped) continue;
    if (Array.isArray(mapped)) turns.push(...mapped);
    else turns.push(mapped);
  }
  if (latestStatusByWamid.size > 0) {
    for (const t of turns) {
      if (t.wamid && latestStatusByWamid.has(t.wamid)) t.status = latestStatusByWamid.get(t.wamid);
    }
  }
  return turns.length > 0 ? turns : null;
}

export default function ChannelChat({ session, channel }) {
  const { since, until, presetKey, setPresetKey } = useDateRange();
  const outbound = useNaturaTable(session, "outbound_leads", { channel, since, until });
  // inbound_leads: fetched the same simple way voice fetches its own rows (channel filter +
  // date filter, both server-side) — EXCEPT the channel filter is dropped, because a voice call's
  // SMS/email confirmation lives on that call's own row (channel='voice'), not a separate
  // channel='sms'/'email' row. Keeping the date filter (same as voice) and just checking this
  // channel's own *_conversation column for content is enough; no extra per-entry logic needed.
  const inbound = useNaturaTable(session, "inbound_leads", { since, until });
  const customers = useNaturaTable(session, "customers");
  const loading = outbound.loading || inbound.loading || customers.loading;
  const error = outbound.error || inbound.error || customers.error;
  const [statusFilter, setStatusFilter] = useState("all");

  const sentimentField = `${SENTIMENT_COLUMN_CHANNEL[channel] || channel}_sentiment`;
  const statusField = `${SENTIMENT_COLUMN_CHANNEL[channel] || channel}_lead_status`;
  const noteField = `${SENTIMENT_COLUMN_CHANNEL[channel] || channel}_note`;

  const threads = useMemo(() => {
    const byCustomer = new Map();
    const nameOf = new Map(customers.rows.map((c) => [c.id, c.name || c.phone || c.email || "Unknown"]));
    const get = (customerId) => {
      if (!byCustomer.has(customerId)) byCustomer.set(customerId, { msgs: [], statuses: [], hasInboundReply: false, systemNotes: [], insights: [] });
      return byCustomer.get(customerId);
    };
    const push = (customerId, entry) => {
      if (!customerId) return;
      get(customerId).msgs.push(entry);
    };
    const pushInsight = (customerId, at, row) => {
      if (!customerId || (!row[statusField] && !row[sentimentField] && !row[noteField])) return;
      get(customerId).insights.push({ at, leadStatus: row[statusField] || null, sentiment: row[sentimentField] || null, note: row[noteField] || null });
    };
    const conversationField = CONVERSATION_COLUMN[channel];
    // inbound_leads and outbound_leads both get the SAME *_conversation array written to them per
    // customer (confirmed: e.g. WhatsApp's "Record Outbound Dispatch" node writes the identical
    // conversation JSON into both tables for the matching customer_id) — so per ROW dedup can't
    // catch the overlap. Pick, per customer, the single longest conversation array across every
    // inbound+outbound row instead, and render only that one; every row still contributes to
    // hasInboundReply/statuses/insights so filters and the sidebar stay accurate.
    const bestConversationByCustomer = new Map(); // customerId -> { turns, len }
    const considerConversation = (customerId, row) => {
      if (!customerId || !conversationField) return null;
      const raw = row[conversationField];
      if (!Array.isArray(raw) || raw.length === 0) return null;
      const existing = bestConversationByCustomer.get(customerId);
      if (!existing || raw.length > existing.len) {
        const turns = parseConversationColumn(channel, raw);
        if (turns) bestConversationByCustomer.set(customerId, { turns, len: raw.length });
      }
      return raw.length > 0;
    };

    for (const r of inbound.rows) {
      // inbound_leads now holds every channel's rows (no server-side channel filter — see fetch
      // comment above). A row belongs on this page if it's this row's own channel, or if it
      // carries data in this channel's *_conversation column (a voice call whose SMS/email
      // confirmation was folded into it). Anything else (e.g. a WhatsApp row on the SMS page) is
      // irrelevant here and must be skipped, not fallen through to inbound_text.
      const conv = conversationField ? r[conversationField] : null;
      const hasOwnConv = Array.isArray(conv) && conv.length > 0;
      if (r.channel !== channel && !hasOwnConv) continue;
      if (r.customer_id) get(r.customer_id); // register the customer even if this row has no insight fields set
      pushInsight(r.customer_id, r.timestamp, r);
      const hasConv = considerConversation(r.customer_id, r);
      if (hasConv) {
        if (r.customer_id) byCustomer.get(r.customer_id).hasInboundReply = true;
        continue;
      }
      const turns = channel === "voice" ? splitVoiceTranscript(r.inbound_text) : null;
      if (turns) {
        // Give each turn a tiny increasing offset off the row's single timestamp so they keep
        // their speaking order when later sorted by `at`, instead of all collapsing to one time.
        turns.forEach((t, i) => push(r.customer_id, { at: new Date(new Date(r.timestamp).getTime() + i).toISOString(), from: t.from, text: t.text }));
      } else {
        push(r.customer_id, { at: r.timestamp, from: "them", text: r.inbound_text || r.note || "(no text)" });
      }
      if (r.customer_id && byCustomer.has(r.customer_id)) byCustomer.get(r.customer_id).hasInboundReply = true;
      if (r.reply_text) push(r.customer_id, { at: r.timestamp, from: "us", text: r.reply_text });
    }
    for (const r of outbound.rows) {
      if (r.customer_id) get(r.customer_id); // register the customer even if this row has no insight fields set
      pushInsight(r.customer_id, r.created_at, r);
      const hasConv = considerConversation(r.customer_id, r);
      if (hasConv) {
        if (r.customer_id) byCustomer.get(r.customer_id).statuses.push(r.status);
        continue;
      }
      // Internal system notes ("Call/text ended without a confirmed booking...", "Booking
      // requested via SMS, not yet confirmed...") are written by the follow-up-logging step, not
      // something Lilian said or the customer said — showing one as a chat bubble reads as a
      // 4th-wall-breaking message in the middle of the conversation. Route it to a separate
      // summary panel instead of the thread.
      const isSystemNote = r.direction === "outbound" && r.status === "queued" && /^(Call|Text|Message) ended without a confirmed booking|^Booking requested via \w+, not yet confirmed/i.test(r.message_text || "");
      if (isSystemNote && r.customer_id) {
        get(r.customer_id).systemNotes.push({ at: r.created_at, text: r.message_text });
        continue;
      }
      push(r.customer_id, { at: r.created_at, from: r.direction === "inbound" ? "them" : "us", text: r.message_text || (r.email_subject ? `(subject) ${r.email_subject}` : "(no text)"), status: r.direction === "outbound" ? r.status : null });
      if (r.direction === "inbound") { if (r.customer_id && byCustomer.has(r.customer_id)) byCustomer.get(r.customer_id).hasInboundReply = true; }
      else if (r.customer_id && byCustomer.has(r.customer_id)) byCustomer.get(r.customer_id).statuses.push(r.status);
    }
    // Render each customer's single best (longest) *_conversation array now that both tables
    // have been scanned — doing this once here, instead of pushing per-row, is what prevents the
    // same conversation turns from being rendered twice (once from inbound_leads, once from
    // outbound_leads) when both rows carry the identical array.
    for (const [customerId, { turns }] of bestConversationByCustomer) {
      if (!byCustomer.has(customerId)) continue;
      turns.forEach((t, i) => push(customerId, { at: t.at || new Date(Date.now() + i).toISOString(), from: t.from, text: t.text, status: t.status || null, isHtml: t.isHtml || false, subject: t.subject || null }));
    }
    return Array.from(byCustomer.entries())
      .map(([id, t]) => {
        const msgs = t.msgs.sort((a, b) => new Date(a.at) - new Date(b.at));
        const bestStatus = t.statuses.length
          ? t.statuses.reduce((best, s) => (STATUS_RANK.indexOf(s) > STATUS_RANK.indexOf(best) ? s : best), t.statuses[0])
          : null;
        const derivedStatus = bestStatus === "replied" || t.hasInboundReply ? "replied" : bestStatus;
        const summary = t.systemNotes.sort((a, b) => new Date(b.at) - new Date(a.at))[0] || null;
        const insight = t.insights.sort((a, b) => new Date(b.at) - new Date(a.at))[0] || null;
        return { id, name: nameOf.get(id) || "Unknown", msgs, last: msgs[msgs.length - 1], status: derivedStatus, summary, insight };
      })
      .sort((a, b) => new Date(b.last?.at || 0) - new Date(a.last?.at || 0));
  }, [inbound.rows, outbound.rows, customers.rows, sentimentField, statusField, noteField]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return threads;
    if (statusFilter === "no_reply") return threads.filter((t) => t.status && t.status !== "replied" && t.status !== "failed" && t.status !== "opted_out");
    return threads.filter((t) => t.status === statusFilter);
  }, [threads, statusFilter]);

  const [activeId, setActiveId] = useState(null);
  const active = filtered.find((t) => t.id === activeId) || filtered[0] || null;
  const label = CHANNEL_LABEL[channel] || channel;
  const [openEmail, setOpenEmail] = useState(null); // { subject, html } | null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-g-word">{label} Chat</h1>
        <p className="mt-1 text-[13px] text-g-muted">Conversation threads from inbound + outbound messages</p>
      </div>

      <DateRangeFilter presetKey={presetKey} onChange={setPresetKey} />

      <ErrorNote error={error} label={`${label} conversations`} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${statusFilter === f.key ? "border-g-gold/70 bg-g-creamd text-g-word" : "border-g-line bg-g-creamd/30 text-g-muted hover:border-g-line"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card><div className="py-10 text-center text-[12px] text-g-muted">Loading…</div></Card>
      ) : threads.length === 0 ? (
        <Card><div className="py-10 text-center text-[12px] text-g-muted">No {label.toLowerCase()} conversations yet.</div></Card>
      ) : filtered.length === 0 ? (
        <Card><div className="py-10 text-center text-[12px] text-g-muted">No conversations match this filter.</div></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="max-h-[560px] overflow-y-auto scroll-clean !p-2">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition ${(active?.id === t.id) ? "bg-g-cream" : "hover:bg-white/[0.03]"}`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.07] text-g-muted"><FaUser size={12} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-g-word">{t.name}</span>
                  <span className="block truncate text-[11px] text-g-muted">{t.last?.text}</span>
                </span>
                <span className="shrink-0 text-[10px] text-g-muted">{timeAgo(t.last?.at)}</span>
              </button>
            ))}
          </Card>

          <div className="grid gap-4">
            {active?.insight && (active.insight.leadStatus || active.insight.sentiment || active.insight.note) && (
              <Card className="!p-0 overflow-hidden">
                <div className="border-b border-g-line bg-white/[0.02] px-4 py-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-g-muted">Lead Status & Sentiment</span>
                  <span className="ml-2 text-[10px] text-g-muted">{timeAgo(active.insight.at)}</span>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {active.insight.leadStatus && (
                      <span className="rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold capitalize text-g-word">
                        {active.insight.leadStatus}
                      </span>
                    )}
                    {active.insight.sentiment && (
                      <span className={`rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold capitalize ${SENTIMENT_TONE[active.insight.sentiment] || "text-g-word"}`}>
                        {active.insight.sentiment}
                      </span>
                    )}
                  </div>
                  {active.insight.note && (
                    <p className="mt-3 text-[12.5px] leading-relaxed text-g-muted">{active.insight.note}</p>
                  )}
                </div>
              </Card>
            )}

            <Card className="max-h-[560px] overflow-y-auto scroll-clean">
              {active ? (
                <div className="grid gap-3">
                  {active.msgs.map((m, i) => (
                    <div key={i} className={`flex ${m.from === "us" ? "justify-end" : "justify-start"}`}>
                      <div className={`${m.isHtml ? "max-w-[92%]" : "max-w-[75%]"} rounded-xl2 px-3.5 py-2.5 text-[13px] ${m.from === "us" ? "bg-g-green/15 text-g-word" : "bg-white/[0.05] text-g-word"}`}>
                        <div className="flex items-center gap-1.5 text-[10px] text-g-muted">
                          {m.from === "us" ? <FaArrowRight size={9} /> : <FaArrowLeft size={9} />}
                          {m.from === "us" ? "Lilian" : active.name} · {timeAgo(m.at)}
                          {m.from === "us" && m.status && (
                            <span className={`ml-1 font-bold capitalize ${MSG_STATUS_TONE[m.status] || "text-g-muted"}`}>· {m.status}</span>
                          )}
                        </div>
                        {m.isHtml ? (
                          <button
                            onClick={() => setOpenEmail({ subject: m.subject, html: m.text })}
                            className="mt-2 flex w-full items-center gap-2.5 rounded-lg border border-g-line bg-white/[0.04] px-3 py-2.5 text-left transition hover:border-g-gold/50 hover:bg-white/[0.07]"
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-g-gold/15 text-g-gold"><FaEnvelopeOpenText size={13} /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-bold text-g-word">{m.subject || "Email"}</span>
                              <span className="block text-[11px] text-g-muted">Click to view full email</span>
                            </span>
                            <FaUpRightFromSquare size={10} className="shrink-0 text-g-muted" />
                          </button>
                        ) : (
                          <div className="mt-1">{m.text}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-[12px] text-g-muted">Select a conversation</div>
              )}
            </Card>
          </div>
        </div>
      )}

      {openEmail && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setOpenEmail(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl2 border border-g-line bg-g-cream shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-g-line px-4 py-3">
              <span className="truncate text-[13px] font-bold text-g-word">{openEmail.subject || "Email"}</span>
              <button onClick={() => setOpenEmail(null)} className="shrink-0 grid h-7 w-7 place-items-center rounded-full text-g-muted hover:bg-white/[0.08] hover:text-g-word">
                <FaXmark size={13} />
              </button>
            </div>
            <iframe title="email-preview" srcDoc={openEmail.html} sandbox="" className="h-[70vh] w-full bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}
