/* Portal "Inbox" tab — UNIFIED INBOX.
 * One place to see + reply to every conversation (SMS · WhatsApp · web-chat · Instagram ·
 * Facebook · phone) with Gui answering automatically and a human able to take over any thread.
 *
 * REAL mode reads live threads from /api/inbox (per-tenant email+key gate → client_events read
 * model in db/inbox.sql), and replies route through the right channel server-side. DEMO mode keeps
 * the original mock behavior (genInbox) so the marketing/demo cockpit still looks alive.
 *
 * OWNERSHIP: this file owns the Inbox view. It does NOT edit Portal.jsx — it only imports the
 * shared UI atoms Portal.jsx exports. Same default export + props ({V,onNav,real,email,dataKey})
 * the orchestrator already wires at the "inbox" tab, so nothing upstream changes. */
import { useState, useEffect, useCallback } from "react";
import { FaPhone, FaWhatsapp, FaCommentSms, FaInstagram, FaFacebook, FaTiktok, FaComments } from "react-icons/fa6";
import { toast } from "../lib/portalApi.js";
import { relTime, tr, genInbox, Card, Empty, ConvoActions, SectionSkeleton } from "../pages/Portal.jsx";

// Channel → [icon, signal color]. Signal palette: WhatsApp=done green, SMS=info blue,
// Webchat=Gui orange, Instagram=live pink, others brand-ish. One place to map a channel.
const CHANNEL_META = {
  WhatsApp: [FaWhatsapp, "#25D366"], SMS: [FaCommentSms, "#38BDF8"], Webchat: [FaComments, "#FF8A33"],
  Instagram: [FaInstagram, "#E4405F"], Facebook: [FaFacebook, "#1877F2"], TikTok: [FaTiktok, "#9ca3af"],
  Phone: [FaPhone, "#38BDF8"], Message: [FaComments, "#9ca3af"],
};
const metaFor = (ch) => CHANNEL_META[ch] || CHANNEL_META.Message;

// POST /api/inbox — always resolves ({} on any failure) so the UI never throws.
async function inboxApi(action, email, key, extra = {}) {
  try {
    const r = await fetch("/api/inbox", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, email, token: key, ...extra }),
    });
    if (!r.ok) return {};
    return (await r.json()) || {};
  } catch { return {}; }
}

// DEMO thread (mock) — mirrors the original Inbox so demo cockpits stay lively.
const demoThread = (c) => [
  { from: "them", text: c.last },
  { from: "ai", text: "Hi! 😊 Thanks for reaching out — I can take care of that right now." },
  { from: "them", text: "Perfect, yes please." },
  { from: "ai", text: `All set ✅ I've noted it and you'll get a confirmation on ${c.channel}. Anything else?` },
];

function Inbox({ V, onNav, real = null, email = "", dataKey = "" }) {
  const isReal = !!real;

  // ── THREAD LIST ──────────────────────────────────────────────────────────
  // Real threads are stamped with the dataKey they were fetched under; if the client switches
  // connection codes in Settings the stale tenant's threads must NEVER render (→ []).
  const [state, setState] = useState({ threads: [], key: "", loaded: false });
  const loadThreads = useCallback(async () => {
    const d = await inboxApi("threads", email, dataKey, { limit: 80 });
    setState({ threads: Array.isArray(d.threads) ? d.threads : [], key: dataKey, loaded: true });
  }, [email, dataKey]);
  useEffect(() => {
    if (!isReal) return;
    let alive = true;
    setState((s) => ({ ...s, loaded: false }));
    loadThreads().finally(() => { if (!alive) return; });
    return () => { alive = false; };
  }, [isReal, loadThreads]);

  const realList = state.key === dataKey ? state.threads : [];
  const demoList = !isReal ? genInbox(V).map((c) => ({ id: c.id, contact: c.name, channel: c.channel, last: c.last, t: c.t, unread: c.unread, human: false, _demo: c })) : [];
  const all = isReal ? realList : demoList;

  const FILTERS = ["All", "WhatsApp", "SMS", "Webchat", "Social", "Phone"];
  const inFilter = (c, f) => f === "All" || (f === "Social" ? ["Instagram", "Facebook", "TikTok"].includes(c.channel) : c.channel === f);
  const [filter, setFilter] = useState("All");
  const [activeId, setActiveId] = useState(null);
  const count = (f) => all.filter((c) => inFilter(c, f)).length;
  const unread = (f) => all.filter((c) => inFilter(c, f) && c.unread).length;
  const list = all.filter((c) => inFilter(c, filter));
  const cur = list.find((c) => c.id === activeId) || list[0];

  // ── OPEN CONVERSATION — messages + takeover flag ─────────────────────────
  const [threads, setThreads] = useState({});   // id → [{from,text}]
  const [human, setHuman] = useState({});        // id → bool (human took over)
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const curKey = cur?.id;

  useEffect(() => {
    if (!cur) return;
    if (!isReal) { setThreads((t) => (t[cur.id] ? t : { ...t, [cur.id]: demoThread(cur._demo || cur) })); return; }
    let alive = true;
    const snapId = cur.id, snapCh = cur.channel, snapLast = cur.last, snapHuman = cur.human === true;
    (async () => {
      const d = await inboxApi("thread", email, dataKey, { thread: snapId, channel: snapCh });
      if (!alive) return;
      const msgs = (Array.isArray(d.messages) ? d.messages : []).map((m) => ({
        from: m.direction === "in" ? "them" : m.direction === "you" ? "you" : "ai", text: m.body,
      }));
      const bubbles = msgs.length ? msgs : (snapLast ? [{ from: "them", text: snapLast }] : []);
      setThreads((t) => ({ ...t, [snapId]: bubbles }));
      setHuman((h) => ({ ...h, [snapId]: d.human === true || snapHuman }));
    })();
    return () => { alive = false; };
  }, [isReal, curKey, email, dataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isHuman = cur ? (human[cur.id] ?? cur.human ?? false) : false;

  // Flip Gui ↔ human on the open thread (persists via a 'takeover' control event).
  const toggleTakeover = async (nextHuman) => {
    if (!cur) return;
    setHuman((h) => ({ ...h, [cur.id]: nextHuman }));
    if (!isReal) { toast(nextHuman ? tr("You're handling this conversation.") : tr("Gui is answering again.")); return; }
    const d = await inboxApi("takeover", email, dataKey, { thread: cur.id, channel: cur.channel, contact: cur.contact, human: nextHuman });
    if (d.ok) toast(nextHuman ? tr("You took over — Gui paused on this thread.") : tr("Gui is answering again."));
    else { setHuman((h) => ({ ...h, [cur.id]: !nextHuman })); toast(tr("Couldn't switch — try again.")); }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!draft.trim() || !cur || sending) return;
    const body = draft;
    setThreads((t) => ({ ...t, [cur.id]: [...(t[cur.id] || []), { from: "you", text: body }] }));
    setDraft("");
    if (!isReal) { toast(`${tr("Done — your reply is on its way via")} ${cur.channel}.`); return; }
    setSending(true);
    const d = await inboxApi("send", email, dataKey, { thread: cur.id, channel: cur.channel, contact: cur.contact, phone: cur.phone || "", body });
    setSending(false);
    if (d.sent) toast(`${tr("Sent via")} ${cur.channel}.`);
    else if (d.pending) toast(d.note || tr("Reply logged — delivery pending on this channel."));
    else toast(tr("Reply failed — try again."));
  };

  const [Icon, color] = cur ? metaFor(cur.channel) : metaFor("Message");
  // Real fetch still in flight AND nothing to show → cement shimmer, never a false-empty inbox.
  if (isReal && (!state.loaded || state.key !== dataKey) && all.length === 0) return <SectionSkeleton />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition ${filter === f ? "border-g-gold/50 bg-g-gold/15 text-g-gold" : "border-white/15 bg-white/[0.04] text-g-muted hover:text-g-word"}`}>
            {f === "All" ? tr("All channels") : f} <span className="text-g-muted">{count(f)}</span>{unread(f) > 0 && <span className="inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black">{unread(f)}</span>}
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4 lg:h-[32rem]">
        {/* Thread list */}
        <Card className="p-0 overflow-hidden lg:col-span-1 flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold shrink-0">{tr("Unified inbox")} · {list.length}</div>
          <div className="divide-y divide-white/[0.06] overflow-y-auto">
            {list.map((c) => {
              const [CI, cc] = metaFor(c.channel);
              const nm = (c.contact || "?").toString();
              return (
                <button key={c.id} onClick={() => setActiveId(c.id)} className={`w-full text-left flex items-center gap-3 px-4 py-3 transition ${c.id === (cur?.id) ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
                  <span className="relative grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] shrink-0 text-sm font-bold text-g-word">{nm[0]?.toUpperCase() || "?"}<span className="absolute -bottom-1 -right-1 grid place-items-center h-4 w-4 rounded-full bg-g-cream" style={{ color: cc }}><CI size={9} /></span></span>
                  <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{nm}{c.human && <span className="ml-1.5 text-[9px] font-black uppercase text-g-gold">· {tr("you")}</span>}</div><div className="text-[11px] text-g-muted truncate">{c.last}</div></div>
                  <div className="text-right shrink-0"><div className="text-[10px] text-g-muted">{c.t || relTime(c.last_at)}</div>{c.unread > 0 && <span className="inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-g-green text-[10px] font-bold text-black mt-0.5">{c.unread}</span>}</div>
                </button>
              );
            })}
            {list.length === 0 && <Empty icon="💬" text={isReal ? tr("No conversations yet — they'll show up here as customers reach out.") : tr("No conversations on this channel right now.")} />}
          </div>
        </Card>
        {/* Conversation view */}
        <Card className="p-0 overflow-hidden lg:col-span-2 flex flex-col">
          {cur && <>
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 shrink-0">
              <span className="grid place-items-center h-8 w-8 rounded-full bg-white/[0.06]" style={{ color }}><Icon size={14} /></span>
              <div className="min-w-0"><div className="text-sm font-bold text-g-word truncate">{cur.contact}</div><div className="text-[10px] text-g-muted">{cur.channel}{cur.phone ? ` · ${cur.phone}` : ""}</div></div>
              <button onClick={() => onNav?.("customers")} className="ml-auto text-[11px] font-bold text-g-gold hover:underline shrink-0">{tr("Customer →")}</button>
            </div>
            {/* Gui ↔ human takeover toggle */}
            <div className="px-4 pt-3 shrink-0">
              <div className="inline-flex rounded-full border border-white/12 bg-black/20 p-0.5 text-[11px] font-bold align-middle">
                <button onClick={() => toggleTakeover(false)} className={`px-3 py-1.5 rounded-full transition ${!isHuman ? "bg-[#FF8A33]/20 text-[#FF8A33]" : "text-g-muted hover:text-g-word"}`}>🤖 {tr("Gui responde")}</button>
                <button onClick={() => toggleTakeover(true)} className={`px-3 py-1.5 rounded-full transition ${isHuman ? "bg-g-gold/20 text-g-gold" : "text-g-muted hover:text-g-word"}`}>🙋 {tr("Eu assumo")}</button>
              </div>
              {isHuman ? <span className="ml-2 text-[10px] font-bold uppercase text-g-gold align-middle">{tr("You're handling this")}</span>
                : <span className="ml-2 text-[10px] font-bold uppercase text-g-green inline-flex items-center gap-1 align-middle"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("AI active")}</span>}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[12rem]">
              {(threads[cur.id] || []).map((m, i) => (
                <div key={i} className={`flex ${m.from === "them" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${m.from === "them" ? "bg-white/[0.06] text-g-word" : m.from === "ai" ? "bg-[#FF8A33]/10 text-g-light border border-[#FF8A33]/30" : "bg-g-gold/15 text-g-word border border-g-gold/30"}`}>
                    {m.from === "ai" && <div className="text-[9px] font-black uppercase mb-0.5" style={{ color: "#FF8A33" }}>Guileo AI</div>}
                    {m.from === "you" && <div className="text-[9px] font-black uppercase text-g-gold mb-0.5">{tr("You")}</div>}
                    {m.text}
                  </div>
                </div>
              ))}
              {(threads[cur.id] || []).length === 0 && <div className="text-center text-[11px] text-g-muted py-6">{tr("No messages yet in this conversation.")}</div>}
            </div>
            <div className="px-3 pt-3 shrink-0"><ConvoActions V={V} who={cur.contact} channel={cur.channel} onNav={onNav} /></div>
            <form onSubmit={send} className="p-3 flex gap-2 shrink-0">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={tr("Reply")} placeholder={isHuman ? `${tr("Reply on")} ${cur.channel}…` : `${tr("Jump in on")} ${cur.channel}…`} className="flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
              <button disabled={sending} className="btn-bright text-sm px-5 disabled:opacity-50">{sending ? tr("Sending…") : tr("Send")}</button>
            </form>
          </>}
          {!cur && <div className="flex-1 grid place-items-center"><Empty icon="💬" text={tr("Pick a conversation to reply.")} /></div>}
        </Card>
      </div>
    </div>
  );
}

export default Inbox;
