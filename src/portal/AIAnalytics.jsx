/* Split out of Portal.jsx (performance): AIAnalytics tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { fetchCallLogs } from "../lib/portalApi.js";
import { aiIntents, aiMissed, BOOK_WORD, tr, UI_LANG, MiniStats, vnum, Card, GuiMark, Empty } from "../pages/Portal.jsx";

function AIAnalytics({ V, onNav, sections = [], real = null, email = "", dataKey = "" }) {
  // Pull the client's real calls so sentiment / intents / transcripts reflect THEIR calls,
  // not the sector sample. Empty (or pre-connect) → falls back to the deterministic demo.
  const [calls, setCalls] = useState(null);
  useEffect(() => {
    let alive = true;
    if (real && email && dataKey) fetchCallLogs(email, dataKey).then((c) => { if (alive) setCalls(Array.isArray(c) ? c : []); });
    return () => { alive = false; };
  }, [real, email, dataKey]);
  const hasReal = calls && calls.length > 0;

  // HONESTY (real mode): with no real calls we NEVER show the sector sample (vnum
  // "980–3200 conversations analyzed", demo sentiment/intents/transcripts). Honest
  // empty-state instead — exactly like CallLogs. Demo mode stays rich below.
  if (real && !hasReal) {
    return (
      <div className="space-y-4 stagger">
        <div className="rounded-2xl border border-g-green/25 bg-gradient-to-br from-g-green/[0.07] to-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — from your real calls")}</div>
          <div className="mt-1 text-xl font-black text-g-word">{tr("Your call analytics appear here")}</div>
        </div>
        <Card><Empty icon="📊" text={calls === null ? tr("Analyzing your calls…") : tr("No calls to analyze yet — sentiment, intents and transcripts appear here as your AI answers.")} /></Card>
      </div>
    );
  }

  // Real sentiment distribution from call_logs (rounded %, sums via the bars).
  const SC = { positive: "#3E9468", neutral: "#D6C29A", negative: "#EF4444" };
  let sentiment = [["Positive", 82, "#3E9468"], ["Neutral", 13, "#D6C29A"], ["Negative", 5, "#EF4444"]];
  let intents = hasReal ? [] : aiIntents(V);
  if (hasReal) {
    const tot = calls.length;
    const c = calls.reduce((a, x) => { const s = (x.sentiment || "neutral").toLowerCase(); a[s] = (a[s] || 0) + 1; return a; }, {});
    sentiment = [["Positive", Math.round(((c.positive || 0) / tot) * 100), SC.positive], ["Neutral", Math.round(((c.neutral || 0) / tot) * 100), SC.neutral], ["Negative", Math.round(((c.negative || 0) / tot) * 100), SC.negative]];
    // Top real intents by frequency.
    const im = new Map();
    calls.forEach((x) => { const k = (x.intent || "").trim(); if (k) im.set(k, (im.get(k) || 0) + 1); });
    const top = [...im.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length) { const max = top[0][1]; intents = top.map(([l, n]) => [l, Math.round((n / max) * 41)]); }
  }
  const intentMax = Math.max(...intents.map(([, v]) => v), 1);
  const missed = aiMissed(V);
  const names = (V.ops?.schedule || []).map((r) => r.name).filter(Boolean);
  const ch1 = (V.channelMix?.items?.[0]?.[0]) || "Phone";
  const book = BOOK_WORD[V.label] || "an appointment";
  const svc = (V.ops?.list?.[0]?.name) || "your services";
  // Real transcripts (most recent 2) when present, else the sector demo.
  const realT = hasReal ? calls.slice(0, 2).map((x) => ({
    who: x.intent || tr("AI call"), ch: "Phone", sent: { positive: "Positive", neutral: "Neutral", negative: "Negative" }[(x.sentiment || "neutral").toLowerCase()] || "Neutral",
    lines: (Array.isArray(x.transcript) ? x.transcript : []).slice(0, 8).map((t) => [t.r === "gui" ? "ai" : "them", t.t]),
  })).filter((t) => t.lines.length) : null;
  // real mode with no stored transcripts → honest empty (never sector demo under a LIVE badge)
  const T = hasReal ? (realT && realT.length ? realT : []) : V.transcripts || [
    { who: names[0] || "A customer", ch: ch1, sent: "Positive", lines: [["them", `Can I book ${book} for tomorrow?`], ["ai", `Of course! What time works best? I'll lock it in.`], ["them", "Around 2pm?"], ["ai", `2pm tomorrow it is — booked ✅ You'll get a reminder the day before.`]] },
    { who: names[1] || "Another customer", ch: "WhatsApp", sent: "Positive", lines: [["them", `How much is ${svc.toLowerCase()}?`], ["ai", `Happy to help — it depends on a couple of details. Can I ask what you need?`], ["them", "Just the basics for now."], ["ai", `Got it — I'll send a quick quote on WhatsApp and can book you in if it looks good. 👍`]] },
  ];

  // #4 — happy-% trend by ISO week (last 5 weeks with calls), computed from the fetched calls.
  const trend = (() => {
    if (!hasReal) return null;
    const wk = (iso) => { const d = new Date(iso); const day = (d.getUTCDay() + 6) % 7; const monday = new Date(d); monday.setUTCDate(d.getUTCDate() - day); return monday.toISOString().slice(0, 10); };
    const byWeek = new Map();
    calls.forEach((c) => { const k = wk(c.created_at); const g = byWeek.get(k) || { pos: 0, tot: 0 }; g.tot++; if ((c.sentiment || "").toLowerCase() === "positive") g.pos++; byWeek.set(k, g); });
    const weeks = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-5);
    return weeks.length >= 2 ? weeks.map(([k, g]) => ({ k, pct: Math.round((g.pos / g.tot) * 100) })) : null;
  })();

  // #2 — opportunities: real calls that ended unhappy or unresolved → what to recover / add.
  const opportunities = hasReal ? calls
    .filter((c) => (c.sentiment || "").toLowerCase() === "negative" || (c.success && c.success !== "success"))
    .slice(0, 4)
    .map((c) => ({ intent: c.intent || tr("AI call"), note: c.note || c.summary || "", neg: (c.sentiment || "").toLowerCase() === "negative" })) : [];

  // "O que o Gui reparou" — a few sharp, concierge-voiced observations derived from the
  // client's REAL calls only (busiest weekday+hour, sentiment trend, top intent, calls to
  // recover). Defensive: every reducer tolerates empty/malformed rows, never crashes.
  const guiNoticed = (() => {
    if (!hasReal) return [];
    const out = [];
    const L = (en, ptStr) => (UI_LANG === "pt" ? ptStr : en); // local en/pt helper (ES handled separately below)
    const WD = UI_LANG === "pt"
      ? ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
      : UI_LANG === "es"
      ? ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
      : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    // Busiest weekday + hour from call timestamps.
    const cells = new Map(); // "wd|hr" -> count
    let bestKey = null, bestN = 0;
    calls.forEach((c) => {
      const d = new Date(c.created_at);
      if (isNaN(d)) return;
      const k = `${d.getDay()}|${d.getHours()}`;
      const n = (cells.get(k) || 0) + 1; cells.set(k, n);
      if (n > bestN) { bestN = n; bestKey = k; }
    });
    if (bestKey && bestN >= 2) {
      const [wd, hr] = bestKey.split("|").map(Number);
      const h12 = ((hr + 11) % 12) + 1; const ap = hr < 12 ? "AM" : "PM";
      const hrLabel = UI_LANG === "pt" ? `${hr}h` : UI_LANG === "es" ? `${hr}:00` : `${h12} ${ap}`;
      out.push(L(`I noticed ${WD[wd]} around ${hrLabel} is your peak — want me to remind your team to staff up?`,
        `Reparei que ${WD[wd]} por volta das ${hrLabel} é seu pico — quer que eu avise sua equipe pra reforçar?`));
    }
    // Sentiment trend up/down across the weekly happy-% series.
    if (trend && trend.length >= 2) {
      const delta = trend[trend.length - 1].pct - trend[0].pct;
      if (delta >= 6) out.push(L(`Your callers are leaving happier — satisfaction is up ${delta} points lately. Lovely to see.`,
        `Seus clientes estão saindo mais felizes — a satisfação subiu ${delta} pontos. Que delícia de ver.`));
      else if (delta <= -6) out.push(L(`Happiness slipped ${Math.abs(delta)} points recently — shall I flag the rough calls so we recover them?`,
        `A satisfação caiu ${Math.abs(delta)} pontos ultimamente — quer que eu separe as ligações difíceis pra gente recuperar?`));
    }
    // Top real intent by frequency.
    const im = new Map();
    calls.forEach((c) => { const k = (c.intent || "").trim(); if (k) im.set(k, (im.get(k) || 0) + 1); });
    const topIntent = [...im.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topIntent && topIntent[1] >= 2) out.push(L(`Most people call about “${topIntent[0]}” — I keep that answer polished and ready.`,
      `A maioria liga por “${topIntent[0]}” — deixo essa resposta sempre afiada e pronta.`));
    // Unhappy calls to recover.
    const unhappy = calls.filter((c) => (c.sentiment || "").toLowerCase() === "negative").length;
    if (unhappy > 0) out.push(L(`${unhappy} ${unhappy === 1 ? "caller" : "callers"} left a little unhappy — say the word and I'll arrange gentle callbacks.`,
      `${unhappy} ${unhappy === 1 ? "pessoa saiu" : "pessoas saíram"} um pouco insatisfeita${unhappy === 1 ? "" : "s"} — é só dizer que organizo retornos com todo cuidado.`));
    // (Removed the "$X still owed" nudge — it read from demo invoices, not real data.)
    return out.slice(0, 4);
  })();

  // ES versions of the guiNoticed lines (kept parallel; L() only covers en/pt).
  const guiNoticedEs = (() => {
    if (UI_LANG !== "es" || !hasReal) return null;
    const out = [];
    const WD = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const cells = new Map(); let bestKey = null, bestN = 0;
    calls.forEach((c) => { const d = new Date(c.created_at); if (isNaN(d)) return; const k = `${d.getDay()}|${d.getHours()}`; const n = (cells.get(k) || 0) + 1; cells.set(k, n); if (n > bestN) { bestN = n; bestKey = k; } });
    if (bestKey && bestN >= 2) { const [wd, hr] = bestKey.split("|").map(Number); out.push(`Noté que el ${WD[wd]} cerca de las ${hr}:00 es tu pico — ¿aviso a tu equipo para reforzar?`); }
    if (trend && trend.length >= 2) { const delta = trend[trend.length - 1].pct - trend[0].pct; if (delta >= 6) out.push(`Tus clientes se van más contentos — la satisfacción subió ${delta} puntos. Un gusto verlo.`); else if (delta <= -6) out.push(`La satisfacción bajó ${Math.abs(delta)} puntos últimamente — ¿te separo las llamadas difíciles para recuperarlas?`); }
    const im = new Map(); calls.forEach((c) => { const k = (c.intent || "").trim(); if (k) im.set(k, (im.get(k) || 0) + 1); });
    const topIntent = [...im.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topIntent && topIntent[1] >= 2) out.push(`La mayoría llama por “${topIntent[0]}” — mantengo esa respuesta lista y pulida.`);
    const unhappy = calls.filter((c) => (c.sentiment || "").toLowerCase() === "negative").length;
    if (unhappy > 0) out.push(`${unhappy} ${unhappy === 1 ? "persona quedó" : "personas quedaron"} algo insatisfecha${unhappy === 1 ? "" : "s"} — dilo y organizo devoluciones de llamada con todo el cuidado.`);
    return out.slice(0, 4);
  })();
  const noticed = guiNoticedEs || guiNoticed;

  return (
    <div className="space-y-4 stagger">
      <MiniStats items={hasReal ? (() => {
        const tot = calls.length;
        const durs = calls.map((c) => Number(c.duration_secs) || 0).filter(Boolean);
        const avg = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0;
        const pos = calls.filter((c) => (c.sentiment || "").toLowerCase() === "positive").length;
        const happy = tot ? Math.round((pos / tot) * 100) : 0;
        return [["Calls analyzed", tot.toLocaleString()], ["Left happy", `${happy}%`, "good"], ["Avg sentiment", happy >= 60 ? "Positive 👍" : happy >= 35 ? "Mixed" : "Needs attention", happy >= 60 ? "good" : ""], ["Avg call time", avg ? (avg >= 60 ? `${Math.floor(avg / 60)}m ${avg % 60}s` : `${avg}s`) : "—"]];
      })() : [["Conversations analyzed", vnum(V.label, "convan", 980, 3200).toLocaleString()], ["Avg sentiment", "Positive 👍", "good"], ["Resolved by AI", `${vnum(V.label, "resai", 86, 95)}%`, "good"], ["Avg handle time", `1m ${vnum(V.label, "handle", 4, 52)}s`]]} />
      {hasReal && <div className="text-[11px] font-bold uppercase tracking-wider text-g-green flex items-center gap-2 -mt-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — from your real calls")}</div>}
      {noticed.length > 0 && (
        <Card className="bg-gradient-to-br from-[#FF8A33]/[0.1] to-g-gold/[0.06] border-[#FF8A33]/30">
          <div className="text-xs font-bold uppercase tracking-wide text-[#FF8A33] flex items-center gap-2 mb-2"><GuiMark size={20} /> {tr("What Gui noticed")}</div>
          <div className="space-y-1.5">
            {noticed.map((n, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-g-word leading-snug">
                <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full" style={{ background: "#FF8A33", boxShadow: "0 0 8px rgba(255,138,51,.55)" }} />
                <span>{n}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Sentiment")}</div>
          {sentiment.map(([l, v, c]) => (<div key={l} className="mb-2.5 last:mb-0"><div className="flex justify-between text-xs mb-1"><span className="text-g-word font-semibold">{l}</span><span className="text-g-muted">{v}%</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v}%`, background: c }} /></div></div>))}
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Why people contact you")}</div>
          {intents.map(([l, v]) => (<div key={l} className="mb-2.5 last:mb-0"><div className="flex justify-between text-xs mb-1"><span className="text-g-word font-semibold">{l}</span></div><div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-g-green" style={{ width: `${Math.max((v / intentMax) * 100, 6)}%` }} /></div></div>))}
        </Card>
      </div>
      {(trend || opportunities.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {trend && (
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Happiness trend")}</div>
              <div className="flex items-end gap-2 h-28">
                {trend.map((w, i) => (
                  <div key={w.k} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <span className="text-[10px] font-bold text-g-word">{w.pct}%</span>
                    <div className="w-full rounded-t-md bg-gradient-to-t from-g-green/40 to-g-green" style={{ height: `${Math.max(w.pct, 4)}%` }} />
                    <span className="text-[9px] text-g-muted">{w.k.slice(5).replace("-", "/")}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-g-muted">{tr("% of callers who left happy, by week.")}</div>
            </Card>
          )}
          {opportunities.length > 0 && (
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("⚡ Opportunities to recover")}</div>
              <div className="space-y-2.5">
                {opportunities.map((o, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-base shrink-0 leading-none mt-0.5">{o.neg ? "😞" : "💡"}</span>
                    <div className="min-w-0"><div className="text-xs font-bold text-g-word">{o.intent}</div>{o.note && <div className="text-[11px] text-g-muted leading-snug">{o.note}</div>}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-g-muted">{tr("A quick callback usually turns these around.")}</div>
            </Card>
          )}
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        {T.map((t, i) => (
          <Card key={i} className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold text-g-word">{t.who} · {t.ch}</span><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-g-green/15 text-g-green">{t.sent}</span></div>
            <div className="p-4 space-y-2">{t.lines.map(([from, text], j) => (<div key={j} className={`flex ${from === "them" ? "justify-start" : "justify-end"}`}><div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs ${from === "them" ? "bg-white/[0.06] text-g-word" : "bg-[#FF8A33]/10 text-g-light border border-[#FF8A33]/30"}`}>{text}</div></div>))}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default AIAnalytics;
