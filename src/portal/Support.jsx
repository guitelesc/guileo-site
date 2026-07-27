/* Split out of Portal.jsx (performance): Support tab view — code moved verbatim. */
import { useState, useRef, useEffect } from "react";
import { matchSupport, SUPPORT_QUICK, SUPPORT_KB } from "../data/supportKB.js";
import { waLink } from "../data/contact.js";
import { UI_LANG, tr, Card, GuiMark } from "../pages/Portal.jsx";

// ── Gui Suporte — the 24/7 concierge support agent. Resolves in milliseconds from
//    the on-device scenario library (matchSupport); falls back to Claude for the rare
//    miss; logs every interaction as a ticket and escalates the sensitive ones to a human.
const SUPPORT_NAV = { open_settings: "settings", open_billing: "billing", open_finance: "finance", open_marketing: "marketing", open_crm: "crm", train_ai: "brain", reactivate_agent: "retention", resend_code: "settings" };

function Support({ onNav, email = "", dataKey = "" }) {
  const lang = UI_LANG;
  const demo = !dataKey;
  const L = (o) => (o && (o[lang] || o.en)) || "";
  const greet = tr("Hi — I'm Gui Support. Tell me what's going on and I'll resolve it right now.");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState([{ role: "gui", text: greet }]);
  const [tab, setTab] = useState("chat");          // chat | tickets
  const [tickets, setTickets] = useState(null);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread, busy]);

  const post = (body) => fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: dataKey || "demo", email, ...body }) });
  const logTicket = (p) => { if (demo) return; post({ action: "create", ...p }).catch(() => {}); };

  const ask = async (text) => {
    const query = (text != null ? text : q).trim();
    if (!query || busy) return;
    setThread((t) => [...t, { role: "you", text: query }]);
    setQ(""); setBusy(true);
    const hit = matchSupport(query, lang);
    if (hit) {
      setThread((t) => [...t, { role: "gui", text: L(hit.a), action: hit.action, escalate: hit.escalate, kb: hit.id }]);
      logTicket({ subject: query.slice(0, 120), category: hit.category, body: query, ai_handled: !hit.escalate, kb_id: hit.id, status: hit.escalate ? "escalated" : "resolved", priority: hit.escalate ? "high" : "normal" });
      setBusy(false); return;
    }
    if (demo) {
      setThread((t) => [...t, { role: "gui", text: tr("In the live cockpit I'd answer this instantly and act on it for you. Connect your account in Settings to turn me on."), action: { kind: "open_settings", label: { en: "Open Settings", pt: "Abrir Configurações", es: "Abrir Configuración" } } }]);
      setBusy(false); return;
    }
    try {
      const r = await post({ action: "ai", question: query, lang });
      const d = await r.json();
      const ans = d.answer || tr("I've logged this and a teammate will follow up shortly.");
      setThread((t) => [...t, { role: "gui", text: ans, escalate: d.escalate }]);
      logTicket({ subject: query.slice(0, 120), category: "other", body: query, ai_handled: !d.escalate, status: d.escalate ? "escalated" : "resolved", priority: d.escalate ? "high" : "normal" });
    } catch {
      setThread((t) => [...t, { role: "gui", text: tr("I'm here — message your team and we'll sort it out fast."), escalate: true }]);
    }
    setBusy(false);
  };

  const loadTickets = async () => {
    setTab("tickets");
    if (demo) { setTickets([{ id: "t1", subject: "How do credits work?", category: "billing", status: "resolved", ai_handled: true, created_at: new Date().toISOString() }, { id: "t2", subject: "Connect my WhatsApp", category: "setup", status: "resolved", ai_handled: true, created_at: new Date().toISOString() }]); return; }
    try { const r = await post({ action: "list", limit: 50 }); const d = await r.json(); setTickets(d.tickets || []); }
    catch { setTickets([]); }
  };

  const quick = SUPPORT_QUICK.map((id) => SUPPORT_KB.find((s) => s.id === id)).filter(Boolean);
  const statusTone = (s) => s === "escalated" ? "text-amber-300 border-amber-400/30 bg-amber-400/10" : s === "open" || s === "resolving" ? "text-sky-300 border-sky-400/30 bg-sky-400/10" : "text-g-light border-g-green/30 bg-g-green/10";

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Conversation */}
      <div className="lg:col-span-2">
        <Card className="p-0 overflow-hidden flex flex-col min-h-[520px]">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10">
            <GuiMark size={30} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-g-word">{tr("Gui Support")} <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold text-g-light"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{tr("online · 24/7")}</span></div>
              <div className="text-[11px] text-g-muted">{tr("Instant answers. A real human supervises everything.")}</div>
            </div>
            <button onClick={() => tab === "tickets" ? setTab("chat") : loadTickets()} className="text-xs font-bold text-g-gold hover:underline shrink-0">{tab === "tickets" ? tr("← Back to chat") : tr("My tickets")}</button>
          </div>

          {tab === "chat" ? (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {thread.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "you" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-xl2 px-4 py-2.5 text-sm ${m.role === "you" ? "bg-g-gold/[0.14] border border-g-gold/25 text-g-word" : "bg-white/[0.04] border border-white/10 text-g-word"}`}>
                      {m.role === "gui" && <div className="text-[10px] font-black uppercase tracking-wider text-g-gold/80 mb-1">Gui</div>}
                      <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                      {m.action && m.action.kind && m.action.kind !== "none" && (
                        <button onClick={() => onNav?.(SUPPORT_NAV[m.action.kind] || "settings")} className="mt-2 btn-bright text-xs">{L(m.action.label)} →</button>
                      )}
                      {m.escalate && <div className="mt-2 text-[11px] font-bold text-amber-300">✓ {tr("Escalated to a human teammate — we'll follow up.")}</div>}
                    </div>
                  </div>
                ))}
                {busy && <div className="flex justify-start"><div className="rounded-xl2 px-4 py-2.5 bg-white/[0.04] border border-white/10 text-sm text-g-muted">{tr("Gui is thinking…")}</div></div>}
                <div ref={endRef} />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="border-t border-white/10 p-3 flex gap-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr("Ask Gui Support")} placeholder={tr("Type your question…")} className="flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
                <button disabled={busy || !q.trim()} className="btn-bright text-sm px-5 disabled:opacity-50">{tr("Send")}</button>
              </form>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tickets == null ? <div className="text-sm text-g-muted">{tr("Loading…")}</div>
                : tickets.length === 0 ? <div className="text-sm text-g-muted text-center py-10">{tr("Nothing yet — every question you ask me shows up here.")}</div>
                : <div className="divide-y divide-white/[0.06]">{tickets.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{t.subject || tr("Support request")}</div><div className="text-[11px] text-g-muted">{t.category}{t.ai_handled ? " · " + tr("resolved by Gui") : ""}</div></div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTone(t.status)}`}>{tr(t.status || "open")}</span>
                    </div>
                  ))}</div>}
            </div>
          )}
        </Card>
      </div>

      {/* Quick help + human */}
      <div className="space-y-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Quick help")}</div>
          <div className="mt-3 flex flex-col gap-2">
            {quick.map((s) => (
              <button key={s.id} onClick={() => { setTab("chat"); ask(L(s.q)); }} className="text-left rounded-xl2 border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm font-semibold text-g-word hover:border-g-gold/40 hover:bg-white/[0.06] transition">{L(s.q)}</button>
            ))}
          </div>
        </Card>
        <Card>
          <div className="text-sm font-extrabold text-g-word">👋 {tr("Talk to a human")}</div>
          <p className="text-xs text-g-muted mt-1">{tr("Gui handles most things instantly. For anything sensitive, a real teammate is one message away.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={waLink("Hi Guileo team! I need help with my account")} target="_blank" rel="noopener" className="btn-ghost text-sm">💬 {tr("I'll message my team")}</a>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Support;
