/* Split out of Portal.jsx (performance): LeadsDigest tab view — code moved verbatim. */
import { useState } from "react";
import { portalApi, toast } from "../lib/portalApi.js";
import { genLeads, logUsage, tr, Card, relTime, Empty, TEMP, UI_LANG } from "../pages/Portal.jsx";

const urgLoc = (u, lang) =>
  lang === "es" ? (u === "Today" ? "Hoy" : u === "This week" ? "Esta semana" : u === "No rush" ? "Sin prisa" : u)
  : lang === "pt" ? (u === "Today" ? "Hoje" : u === "This week" ? "Esta semana" : u === "No rush" ? "Sem pressa" : u)
  : u;
const leadStatus = (kind, lang) => {
  const p3 = (en, pt, es) => (lang === "es" ? es : lang === "pt" ? pt : en);
  return kind === "call" ? p3("📞 Gui calling… −5 credits", "📞 Gui ligando… −5 créditos", "📞 Gui llamando… −5 créditos")
  : kind === "msg" ? p3("💬 Gui messaged · −2 credits", "💬 Gui mandou mensagem · −2 créditos", "💬 Gui envió mensaje · −2 créditos")
  : kind === "self" ? p3("✋ You'll respond", "✋ Você vai responder", "✋ Tú responderás")
  : p3("✖️ Dismissed", "✖️ Descartado", "✖️ Descartado");
};

function LeadsDigest({ V, onNav, lang, real = null }) {
  const pt = lang === "pt", es = lang === "es";
  const p3 = (en, ptv, esv) => (es ? esv : pt ? ptv : en); // 3-way string pick for this component
  const key = `${V.label}:leadActions`;
  const [acts, setActs] = useState(() => portalApi.loadState(key, {}));
  const leads = genLeads(V);
  const act = (lead, kind) => {
    const cost = kind === "call" ? 5 : kind === "msg" ? 2 : 0;
    if (cost) logUsage(cost, `Gui ${kind === "call" ? "called" : "messaged"} ${lead.name} · ${lead.service}`);
    const next = { ...acts, [lead._id]: { kind, at: Date.now() } };
    portalApi.saveState(key, next); setActs(next);
    toast(
      kind === "call" ? p3(`Gui is calling ${lead.name} now · −5 credits`, `Gui vai ligar pro ${lead.name} agora · −5 créditos`, `Gui está llamando a ${lead.name} ahora · −5 créditos`)
      : kind === "msg" ? p3(`Gui messaged ${lead.name} · −2 credits`, `Gui mandou mensagem pro ${lead.name} · −2 créditos`, `Gui envió un mensaje a ${lead.name} · −2 créditos`)
      : kind === "self" ? p3(`Got it: you'll respond to ${lead.name}`, `Combinado: você responde ${lead.name}`, `Entendido: tú responderás a ${lead.name}`)
      : p3("Lead dismissed", "Lead descartado", "Lead descartado")
    );
  };
  const reset = (lead) => { const n = { ...acts }; delete n[lead._id]; portalApi.saveState(key, n); setActs(n); };
  const groups = ["hot", "warm", "cold"];
  const counts = groups.reduce((m, g) => { m[g] = leads.filter((l) => l.temp === g).length; return m; }, {});
  const open = leads.filter((l) => !acts[l._id]);
  const totalVal = open.reduce((s, l) => s + l.value, 0);

  // REAL MODE — list the actual `lead` events from the client's live ledger.
  if (real) {
    const leadEvents = (real?.events || []).filter((e) => e.type === "lead");
    return (
      <div className="space-y-5 stagger">
        <div className="rounded-2xl border border-g-green/25 bg-gradient-to-br from-g-green/[0.07] to-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — your real leads", lang)}</div>
          <div className="mt-1 text-xl font-black text-g-word">{leadEvents.length} {tr(leadEvents.length === 1 ? "lead recorded" : "leads recorded", lang)}</div>
        </div>
        {leadEvents.length ? (
          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-white/[0.05]">
              {leadEvents.map((e, i) => (
                <div key={e.id || i} style={{ animationDelay: `${i * 50}ms` }} className="row-in flex items-center gap-3 px-5 py-3">
                  <span className="text-base shrink-0">🎯</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{e.summary}</div>
                    <div className="text-[11px] text-g-muted">{e.channel || "—"} · {relTime(e.created_at)}</div>
                  </div>
                  {Number(e.amount) > 0 && <span className="text-xs font-extrabold text-g-green money-glow num shrink-0">${Number(e.amount).toLocaleString()}</span>}
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Empty icon="🎯" text={tr("No lead events yet — they'll appear here as your AI captures them.", lang)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 stagger">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-gold"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{p3("Today's digest · Gui qualified these while you slept", "Resumo de hoje · Gui qualificou enquanto você dormia", "Resumen de hoy · Gui los calificó mientras dormías")}</div>
        <div className="mt-1 text-xl font-black text-g-word">{open.length} {p3("new leads to decide on", "leads novos pra você decidir", "leads nuevos para decidir")}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {groups.map((g) => counts[g] ? (
            <span key={g} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: TEMP[g].dot + "55", color: TEMP[g].dot }}>{TEMP[g].emoji} {counts[g]} {es && TEMP[g].es ? TEMP[g].es : pt ? TEMP[g].pt : TEMP[g].en}</span>
          ) : null)}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-g-green/30 bg-g-green/[0.06] px-3 py-1 text-xs font-bold text-g-green money-glow num">💰 ${totalVal.toLocaleString()} {p3("in play", "em jogo", "en juego")}</span>
        </div>
        <p className="mt-3 text-[11px] text-g-muted leading-relaxed">{p3("Respond yourself (free) or let Gui call/message — Gui executes and uses credits. Idle 🔥 hot leads auto-escalate to Gui in 2h (you're warned first; you can grab them).", "Responda você (grátis) ou peça pro Gui ligar/mandar — aí ele executa e desconta créditos. Leads 🔥 quentes parados o Gui assume sozinho em 2h (avisa antes; você pode segurar).", "Responde tú (gratis) o deja que Gui llame/escriba — Gui ejecuta y usa créditos. Los leads 🔥 calientes inactivos los asume Gui en 2h (te avisa antes; puedes tomarlos tú).")}</p>
      </div>

      {groups.map((g) => {
        const list = leads.filter((l) => l.temp === g);
        if (!list.length) return null;
        return (
          <div key={g}>
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide" style={{ color: TEMP[g].dot }}>{TEMP[g].emoji} {es && TEMP[g].es ? TEMP[g].es : pt ? TEMP[g].pt : TEMP[g].en} <span className="text-g-muted font-bold">· {list.length}</span></div>
            <div className="space-y-2.5">
              {list.map((lead) => {
                const a = acts[lead._id];
                return (
                  <div key={lead._id} className={`rounded-xl border p-4 ${TEMP[g].ring}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-g-word">{lead.name}<span className="text-[10px] font-bold text-g-muted">· {lead.channel} · {lead.ago}{p3(" ago", " atrás", " atrás")}</span></div>
                      <div className="mt-0.5 text-[12px] text-g-muted">{UI_LANG === "es" ? lead.note.es : UI_LANG === "pt" ? lead.note.pt : lead.note.en}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-g-light">{lead.service}</span>
                        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-g-green num">💰 ${lead.value.toLocaleString()}</span>
                        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-g-light">⏱ {urgLoc(lead.urgency, lang)}</span>
                      </div>
                    </div>
                    {!a ? (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={() => act(lead, "self")} className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-[12px] font-bold text-g-word hover:bg-white/[0.09] transition">{p3("Respond myself", "Respondo eu", "Respondo yo")}</button>
                          <button onClick={() => act(lead, "call")} className="rounded-lg border border-g-green/40 bg-g-green/[0.10] px-3 py-1.5 text-[12px] font-bold text-g-light hover:bg-g-green/20 transition">📞 {p3("Gui calls", "Gui liga", "Gui llama")} <span className="text-g-muted font-semibold">−5</span></button>
                          <button onClick={() => act(lead, "msg")} className="rounded-lg border border-g-gold/35 bg-g-gold/[0.08] px-3 py-1.5 text-[12px] font-bold text-g-gold hover:bg-g-gold/15 transition">💬 {p3("Gui messages", "Gui manda", "Gui escribe")} <span className="text-g-muted font-semibold">−2</span></button>
                          <button onClick={() => act(lead, "dismiss")} className="rounded-lg px-3 py-1.5 text-[12px] font-bold text-g-muted hover:text-g-word transition">{p3("Dismiss", "Descartar", "Descartar")}</button>
                        </div>
                        {g === "hot" && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#e0855f]">⏱ {p3("Gui auto-calls in 2h if you don't act", "Gui liga em 2h se você não cuidar", "Gui llama en 2h si no actúas")} <button onClick={() => act(lead, "self")} className="underline text-g-muted hover:text-g-word">{p3("I'll handle it", "deixa que eu cuido", "yo me encargo")}</button></div>
                        )}
                      </>
                    ) : (
                      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2">
                        <span className="text-[12px] font-bold text-g-light">{leadStatus(a.kind, lang)}</span>
                        <button onClick={() => reset(lead)} className="text-[11px] font-bold text-g-muted hover:text-g-word underline">{p3("undo", "desfazer", "deshacer")}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] text-g-muted">{p3("Want this digest on WhatsApp / email / SMS every day?", "Quer esse resumo no WhatsApp / e-mail / SMS todo dia?", "¿Quieres este resumen en WhatsApp / correo / SMS cada día?")}</div>
        <button onClick={() => onNav("integrations")} className="btn-bright text-[12px] shrink-0">{p3("Turn on channels →", "Ligar canais →", "Activar canales →")}</button>
      </div>
    </div>
  );
}

export default LeadsDigest;
