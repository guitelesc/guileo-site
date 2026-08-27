/* Split out of Portal.jsx (performance): AIInsights tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { FaArrowTrendUp } from "react-icons/fa6";
import { toast, fetchCallLogs } from "../lib/portalApi.js";
import { genRecommendations, genForecast, aiMissed, Card, GuiMark, tr, Empty, genBenchmarks } from "../pages/Portal.jsx";

/* ── UM INSIGHT DE VERDADE, DE GRAÇA (2026-08-25) ──────────────────────────────────────────────
   Esta aba inteira era amostra em modo real: demanda, no-show e benchmark saem de `vnum` (semente
   determinística por setor), e a honestidade se resumia a carimbar "Sample" em cada cartão. Um
   cliente pagante abria "AI Insights" e não havia UM número dele ali dentro.
   Não precisou de RPC nova nem de crédito de IA: `fetchCallLogs` é a MESMA leitura que a aba
   Analytics já faz, e cada ligação traz `intent`. Contar intenção por frequência responde a
   pergunta que o dono faz de verdade — "pra que as pessoas me ligam?" — com dado dele.
   🚨 SEM LIGAÇÃO COM INTENÇÃO, O BLOCO NÃO DESENHA. Zero ligação não vira gráfico vazio nem
   percentual de nada: null ≠ 0, e barra sem lastro é a mesma ficção que o resto da aba declara. */
function IntencoesReais({ email, dataKey }) {
  const [calls, setCalls] = useState(null);   // null = carregando; [] = lido e vazio
  useEffect(() => {
    let vivo = true;
    if (!email || !dataKey) { setCalls([]); return () => { vivo = false; }; }
    fetchCallLogs(email, dataKey).then((c) => { if (vivo) setCalls(Array.isArray(c) ? c : []); }).catch(() => { if (vivo) setCalls([]); });
    return () => { vivo = false; };
  }, [email, dataKey]);
  if (calls === null || calls.length === 0) return null;

  const mapa = new Map();
  calls.forEach((x) => { const k = (x.intent || "").toString().trim(); if (k) mapa.set(k, (mapa.get(k) || 0) + 1); });
  const top = [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!top.length) return null;   // ligações existem mas nenhuma tem intenção gravada → nada a dizer

  const comIntencao = top.reduce((s, [, n]) => s + n, 0);
  const maior = top[0][1];
  return (
    <Card className="p-0 overflow-hidden border-g-green/30">
      <div className="px-5 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Why people call you — your own calls")}</span>
        <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-g-green">
          <span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — from your real calls")}
        </span>
      </div>
      <div className="p-5 space-y-3">
        {top.map(([rotulo, n]) => (
          <div key={rotulo}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-g-word truncate pr-2">{rotulo}</span>
              {/* o número é a CONTAGEM crua, não um percentual derivado de amostra pequena */}
              <span className="text-g-muted tabular-nums shrink-0">{n}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${Math.max(6, (n / maior) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-2.5 border-t border-white/[0.06] text-[11px] text-g-muted">
        {comIntencao} {tr("of")} {calls.length} {tr("calls with a recorded intent.")}
      </div>
    </Card>
  );
}

// Consolidated AI Insights tab — recommendations (apply in 1 click) + demand/no-show
// forecast + industry benchmarks, all in one place.
function AIInsights({ V, onNav, sections = [], real = null, email = "", dataKey = "" }) {
  // HONESTY (real mode): demand/no-show/benchmarks are a sector SAMPLE (vnum-derived),
  // not this tenant's live data — so in real we label them "Sample" and disable the
  // actions that only toast (they don't place a real call/deposit yet).
  const Sample = () => real ? <span className="text-[9px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1.5 py-0.5">{tr("Sample")}</span> : null;
  const has = new Set(sections.map(([k]) => k));
  const recs = genRecommendations(V).filter((r) => has.has(r.view));
  const fc = genForecast(V);
  const fcMax = Math.max(...fc.load);
  const missed = aiMissed(V);
  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-[#FF8A33]/[0.1] to-g-gold/[0.06] border-[#FF8A33]/30">
        <div className="text-sm font-extrabold text-g-word flex items-center gap-2"><GuiMark size={24} /> {tr("AI Insights")}</div>
        <div className="text-xs text-g-muted mt-0.5">{tr("What your AI sees in your numbers — and the exact moves to grow faster. Apply any of them in one click.")}</div>
      </Card>

      {/* o único bloco desta aba feito do dado DELE — vem antes de tudo que é amostra */}
      {real && <IntencoesReais email={email} dataKey={dataKey} />}

      <Card className="border-g-gold/30 bg-g-gold/[0.05] p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("⚡ Recommended by your AI · apply in one click")}</div>
        <div className="divide-y divide-white/[0.06]">
          {recs.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className="text-lg shrink-0">{r.ic}</span>
              <div className="flex-1 min-w-0 text-xs text-g-word leading-snug">{tr(r.text)}</div>
              <button onClick={() => r.apply(onNav)} className="text-[11px] font-bold rounded-full border border-g-green/40 bg-g-green/[0.1] px-3 py-1.5 text-g-green hover:bg-g-green/20 transition shrink-0">{r.cta} →</button>
            </div>
          ))}
        </div>
        <div className="px-5 py-2.5 border-t border-white/[0.06] text-[11px] text-g-muted">{tr(missed[0])}</div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-1 flex items-center gap-2">{tr("🔮 Predicted demand · next 7 days")} <Sample /></div>
          <div className="text-[11px] text-g-muted mb-3"><b className="text-g-green">{fc.peak}</b> peaks at <b className="text-g-word">{fc.peakLoad}%</b> — open more capacity. <b className="text-g-muted">{fc.low}</b> is quietest — a promo fills it.</div>
          <div className="flex items-end gap-1.5 h-24">
            {fc.load.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t" style={{ height: `${(v / fcMax) * 100}%`, background: v >= 100 ? "#EF4444" : v >= 80 ? "#D6C29A" : "#3E9468", minHeight: "4px" }} title={`${v}%`} />
                <span className="text-[9px] text-g-muted">{tr(fc.days[i])}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[9px] text-g-muted"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-g-green" />{tr("Normal")}</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: "#D6C29A" }} />{tr("Busy")}</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" />{tr("Over capacity")}</span></div>
        </Card>
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2">{tr("⚠ No-show risk · AI flagged")} <Sample /></div>
          <div className="divide-y divide-white/[0.06]">
            {fc.risk.length ? fc.risk.map((name, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#FFC23D", boxShadow: "0 0 8px rgba(255,194,61,.55)" }} />
                <div className="flex-1 min-w-0 text-sm font-bold text-g-word truncate">{name}</div>
                {real
                  ? <span className="text-[11px] font-bold rounded-full border border-white/10 px-2.5 py-1 text-g-muted cursor-default" title={tr("Available when connected")}>{tr("Available when connected")}</span>
                  : <button onClick={() => toast(`Taken care of — I've sent ${name} a deposit request and a gentle reminder.`)} className="text-[11px] font-bold rounded-full border border-white/15 px-2.5 py-1 text-g-word hover:border-g-gold/40 transition min-h-[44px] inline-flex items-center">{tr("Secure")}</button>}
              </div>
            )) : <Empty icon="✅" text={tr("No high-risk bookings — your AI's reminders are keeping no-shows low.")} />}
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2">📊 How you compare · vs {V.label.toLowerCase()} average <Sample /></div>
        <div className="divide-y divide-white/[0.06]">
          {genBenchmarks(V).map((b, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{b.label}</div><div className="text-[11px] text-g-muted">You: <b className="text-g-green">{b.you}</b> · Industry avg: {b.avg}</div></div>
              <span className="text-[10px] font-black uppercase text-g-green inline-flex items-center gap-1 shrink-0"><FaArrowTrendUp size={10} /> {b.delta}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-2.5 border-t border-white/[0.06] text-[11px] text-g-muted">{real ? tr("Sample sector benchmark — your live comparison appears as your data builds up.") : tr("You're outperforming your sector on every metric your AI touches.")}</div>
      </Card>
    </div>
  );
}

export default AIInsights;
