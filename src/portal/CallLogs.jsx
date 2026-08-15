/* Split out of Portal.jsx (performance): CallLogs tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { FaPhone } from "react-icons/fa6";
import { fetchCallLogs } from "../lib/portalApi.js";
import { waLink, waTo } from "../data/contact.js";
import { genCalls, tr, Card, relTime, Empty, UI_LANG, Drawer, MiniStats, vnum, ConvoActions, SectionSkeleton } from "../pages/Portal.jsx";

// Sentiment vocabulary — one place maps the Haiku label → emoji, color, human word.
const SENTIMENT_META = {
  positive: { emoji: "😊", color: "#3E9468", en: "Happy", pt: "Feliz", es: "Feliz" },
  neutral: { emoji: "😐", color: "#D6C29A", en: "Neutral", pt: "Neutro", es: "Neutral" },
  negative: { emoji: "😞", color: "#EF4444", en: "Unhappy", pt: "Insatisfeito", es: "Insatisfecho" },
};
function sentimentOf(e) { return SENTIMENT_META[(e?.payload?.sentiment || "").toLowerCase()] || null; }
// Map a call_logs row (from /api/call-logs) onto the event-like shape the drawer/list expect,
// nesting the analysis under `payload` exactly like the webhook writes it.
function callRowToEvent(c) {
  return {
    id: c.id, created_at: c.created_at, channel: "Phone · AI", summary: c.summary, amount: Number(c.amount) || 0,
    payload: {
      sentiment: c.sentiment, intent: c.intent, note: c.note, duration_secs: c.duration_secs,
      success: c.success, end_reason: c.end_reason, summary_clean: c.summary, transcript: Array.isArray(c.transcript) ? c.transcript : [],
    },
  };
}
function CallLogs({ V, onNav, real = null, email = "", dataKey = "" }) {
  const rows = V.callLogs || genCalls(V);
  const [sel, setSel] = useState(null);
  // Real calls WITH transcript come from the owned project via /api/call-logs. Falls back to
  // the events ledger (no transcript) if that fetch is empty — the screen never breaks.
  const [logged, setLogged] = useState(null);
  useEffect(() => {
    let alive = true;
    if (real && email && dataKey) fetchCallLogs(email, dataKey).then((c) => { if (alive) setLogged(Array.isArray(c) ? c.map(callRowToEvent) : []); });
    return () => { alive = false; };
  }, [real, email, dataKey]);
  // REAL MODE — the actual calls your AI handled, WITH the per-call analysis
  // (sentiment + intent + duration + why it ended) and the full transcript.
  if (real) {
    const calls = (logged && logged.length ? logged : (real?.events || []).filter((e) => e.type === "call"));
    // Sentiment tally across real calls — the "did my customers leave happy?" headline.
    const tally = calls.reduce((a, e) => { const s = (e?.payload?.sentiment || "").toLowerCase(); if (a[s] != null) a[s]++; return a; }, { positive: 0, neutral: 0, negative: 0 });
    const rated = tally.positive + tally.neutral + tally.negative;
    const happyPct = rated ? Math.round((tally.positive / rated) * 100) : null;
    const fmtDur = (s) => s == null ? null : (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
    return (
      <div className="space-y-4 stagger">
        <div className="rounded-2xl border border-g-green/25 bg-gradient-to-br from-g-green/[0.07] to-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — your real calls")}</div>
          <div className="mt-1 text-xl font-black text-g-word">{calls.length} {tr(calls.length === 1 ? "call handled by AI" : "calls handled by AI")}</div>
          {rated > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              {happyPct != null && <span className="font-black text-g-green">{happyPct}% {tr("left happy")}</span>}
              <span className="text-g-word">😊 {tally.positive}</span>
              <span className="text-g-word">😐 {tally.neutral}</span>
              <span className="text-g-word">😞 {tally.negative}</span>
            </div>
          )}
        </div>
        {calls.length ? (
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recent calls · answered by AI")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 {tr("tap for transcript")}</span></div>
            <div className="divide-y divide-white/[0.05]">
            {calls.map((e, i) => {
              const sm = sentimentOf(e); const p = e.payload || {};
              return (
              <button key={e.id || i} onClick={() => setSel(e)} style={{ animationDelay: `${i * 50}ms` }} className="row-in w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] shrink-0 text-base" style={{ color: sm?.color || "#3E9468" }}>{sm ? sm.emoji : <FaPhone size={13} />}</span>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{p.summary_clean || e.summary}</div><div className="text-[11px] text-g-muted truncate">{p.intent ? p.intent + " · " : ""}{e.channel || "Phone · AI"} · {relTime(e.created_at)}</div></div>
                <div className="text-right shrink-0">
                  {fmtDur(p.duration_secs) && <div className="text-[11px] text-g-light font-bold">{fmtDur(p.duration_secs)}</div>}
                  {Number(e.amount) > 0 && <div className="text-xs font-extrabold text-g-green money-glow num">+${Number(e.amount).toLocaleString()}</div>}
                </div>
              </button>
            );})}
          </div></Card>
        ) : logged === null ? <SectionSkeleton rows={4} /> /* fetch in flight — never a false "no calls" */
          : <Card><Empty icon="📞" text={tr("No calls yet — I'm standing by, answering 24/7.")} /></Card>}
        {sel && (() => {
          const sm = sentimentOf(sel); const p = sel.payload || {};
          const tx = Array.isArray(p.transcript) ? p.transcript : [];
          const lang = UI_LANG === "es" ? "es" : UI_LANG === "pt" ? "pt" : "en";
          const fields = [
            p.intent && [tr("Intent"), p.intent],
            fmtDur(p.duration_secs) && [tr("Duration"), fmtDur(p.duration_secs)],
            [tr("When"), relTime(sel.created_at)],
            [tr("Channel"), sel.channel || "Phone · AI"],
            // ⚠️ NÃO volte a escrever "Successful ✓" aqui. Este campo vem da AUTO-AVALIAÇÃO do modelo
            // e significa "a ligação rodou até o fim" — NÃO "o cliente conseguiu o que queria". Em
            // 2026-08-10 medimos a frota: 13 ligações marcadas "success", 1 agendamento real. Uma
            // delas (Kashif, Natura) era um cliente pronto que foi embora sem marcar nada — e o dono
            // veria um ✓ verde. Métrica que mente é pior que métrica ausente: a ausente você vai
            // atrás, a que mente você acredita.
            p.success && [tr("Call ran to the end"), p.success === "success" ? tr("Yes") : tr("No")],
            // O ÚNICO desfecho que sabemos com certeza hoje é dinheiro: se entrou valor, entrou.
            // Agendamento ainda não dá para amarrar a ESTA ligação (call_logs não guarda o telefone
            // e a ferramenta de agenda não recebe o id da conversa) — e afirmar por janela de tempo
            // seria trocar um palpite por outro. Enquanto não houver o elo, esta linha diz a verdade:
            // não sabemos. Ver ⏳ em MOTORES.md.
            [tr("Confirmed result"), Number(sel.amount) > 0
              ? `${tr("collected")} $${Number(sel.amount).toFixed(2)}`
              : tr("not confirmed — read the summary")],
            p.end_reason && [tr("How it ended"), p.end_reason],
          ].filter(Boolean);
          return (
            <Drawer
              title={p.summary_clean || sel.summary?.replace(/^[😊😐😞]\s*/, "") || tr("AI call")}
              subtitle={relTime(sel.created_at)}
              badge={sm ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sm.color + "22", color: sm.color }}>{sm.emoji} {sm[lang]}</span> : null}
              fields={fields}
              note={p.note ? <><span className="text-g-muted">{tr("AI summary:")}</span> <span className="text-g-word">{p.note}</span></> : null}
              actions={<a href={waLink("")} target="_blank" rel="noopener" className="btn-ghost text-sm">{tr("💬 Message")}</a>}
              onClose={() => setSel(null)}
            >
              <div>
                <div className="text-[10px] font-black uppercase tracking-wide text-g-muted mb-2">{tr("Full transcript")}</div>
                {tx.length ? (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {tx.map((t, j) => (
                      <div key={j} className={`flex ${t.r === "gui" ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] ${t.r === "gui" ? "bg-[#FF8A33]/10 text-g-light border border-[#FF8A33]/25" : "bg-white/[0.06] text-g-word"}`}>
                          <span className={`block text-[9px] font-black uppercase tracking-wide mb-0.5 ${t.r === "gui" ? "" : "opacity-50"}`} style={t.r === "gui" ? { color: "#FF8A33" } : undefined}>{t.r === "gui" ? "Gui" : tr("Customer")}</span>
                          {t.t}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[13px] text-g-muted">{tr("Transcript syncing — it appears here once the call finishes processing.")}</p>}
              </div>
            </Drawer>
          );
        })()}
      </div>
    );
  }
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Calls answered", `${vnum(V.label, "callsans", 210, 540)}`], ["Missed calls", "0", "good"], ["Avg. duration", `1m ${vnum(V.label, "calldur", 2, 54)}s`], ["Handled by AI", "100%", "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recent calls · answered by AI")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap for transcript</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
          <button key={i} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06]" style={{ color: c.color }}><FaPhone size={13} /></span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name} <span className="text-g-muted font-normal">· {c.phone}</span></div><div className="text-[11px] text-g-muted truncate">{c.outcome}</div></div>
            <div className="text-right shrink-0"><div className="text-[11px] text-g-light font-bold">{c.dur}</div><div className="text-[10px] text-g-muted">{c.time}</div></div>
          </button>
          ))}
          {rows.length === 0 && <Empty icon="📞" text={tr("No calls yet — I'm standing by, answering 24/7.")} />}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={sel.phone}
          badge={<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-g-green/15 text-g-green">{tr("Positive")}</span>}
          fields={[["Outcome", sel.outcome], ["Duration", sel.dur], ["When", sel.time], ["Channel", "Phone · AI"], ["Resolved", "By AI ✓"]]}
          note={<>Transcript summary:<div className="mt-1.5 space-y-1 text-g-word">{[["📞", `${sel.name}: ${sel.outcome.replace(/·.*/, "").trim() || "Hi, calling about my booking."}`], ["🤖", "Guileo AI: Happy to help — all sorted! Anything else?"], ["📞", `${sel.name}: That's perfect, thank you!`]].map(([ic, t], j) => <div key={j}>{ic} {t}</div>)}</div></>}
          actions={<><a href={`tel:${sel.phone.replace(/[^0-9+]/g, "")}`} className="btn-bright text-sm">{tr("📞 Call back")}</a><a href={waTo(sel.phone, `Hi ${sel.name}! `)} target="_blank" rel="noopener" className="btn-ghost text-sm">{tr("💬 Message")}</a></>}
          onClose={() => setSel(null)}
        >
          <div><div className="text-[10px] font-black uppercase tracking-wide text-g-muted mb-2">{tr("Turn this call into action")}</div><ConvoActions V={V} who={sel.name} channel="call" onNav={onNav} onDone={() => setSel(null)} /></div>
        </Drawer>
      )}
    </div>
  );
}

export default CallLogs;
