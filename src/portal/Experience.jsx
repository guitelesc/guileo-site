/* Experiência tab — the CLIENT's Qualtrics-like XM dashboard: the tenant measuring ITS OWN
   customers (the customer-of-the-customer). Backend: POST /api/experience { email, dataKey } →
   experience RPC (tenant-gated the same way /api/revenue + /api/crm are). One non-destructive
   action: "Gui reconquista" = close-the-loop on a detractor (POST { action:'close_loop', signal_id })
   which only marks the signal handled — it NEVER promises a refund or discount.

   This is a DIFFERENT layer from Guileo's own NPS (db/nps.sql / functions/api/nps.js = Guileo
   measuring its tenants). This view is the tenant measuring its customers. Read-only + one mark-handled.

   Self-contained trilingual (PT/ES/EN) via UI_LANG, matching the sibling *.jsx tabs' cement/signal
   styling, real-mode gating, skeletons and honest empty states (RiskRadar.jsx / GuileoImpact.jsx). */
import { useState, useEffect } from "react";
import { FaFaceSmile, FaArrowTrendUp, FaArrowTrendDown, FaHeart, FaScrewdriverWrench, FaHandHoldingHeart, FaStar } from "react-icons/fa6";
import { loadDataKey, toast } from "../lib/portalApi.js";
import { Count } from "../lib/ui.jsx";
import { Card, Empty, SectionSkeleton, UI_LANG, relTime, vnum } from "../pages/Portal.jsx";

// ── self-contained trilingual dictionary (works in all 3 langs without touching the shared dict-*.js)
const STR = {
  en: {
    title: "Customer Experience", sub: "How your customers feel — measured across every call, message and review.",
    live: "LIVE — real data", sample: "Sample data — connect your account to see your real experience score.", est: "estimate",
    cx: "Experience Score", nps: "NPS", csat: "CSAT", collecting: "Coletando…", collectingBody: "Feedback shows here as your customers respond.",
    vsPrior: "vs prior 30d", sentiment: "Sentiment mix", pos: "Positive", neu: "Neutral", neg: "Negative",
    love: "Amam", fix: "Pra melhorar", loveEmpty: "The themes customers praise most will appear here.", fixEmpty: "The themes to fix will appear here.",
    detractors: "Detratores que precisam de você", detractorsSub: "Unhappy customers — reach them before they churn.",
    detractorsEmpty: "No unhappy customers right now — your experience is healthy.",
    reconquer: "Gui reconquista", handled: "Gui está reconquistando ✓", mentions: "mentions",
    window: "Last 30 days", smallNote: "Small sample — read these as early signals, not verdicts.", of: "of",
    surveyTitle: "Auto-survey after each visit", surveyDesc: "Gui asks your customers a 1-tap NPS/CSAT by email after they visit. On by default — turn off anytime.",
    on: "On", off: "Off", surveyOnMsg: "Auto-survey on ✓", surveyOffMsg: "Auto-survey off",
  },
  pt: {
    title: "Experiência do Cliente", sub: "Como seus clientes se sentem — medido em cada ligação, mensagem e avaliação.",
    live: "AO VIVO — dados reais", sample: "Dados de exemplo — conecte sua conta para ver seu score real de experiência.", est: "estimativa",
    cx: "Score de Experiência", nps: "NPS", csat: "CSAT", collecting: "Coletando…", collectingBody: "O feedback aparece aqui conforme seus clientes respondem.",
    vsPrior: "vs. 30d anteriores", sentiment: "Mix de sentimento", pos: "Positivo", neu: "Neutro", neg: "Negativo",
    love: "Amam", fix: "Pra melhorar", loveEmpty: "Os temas mais elogiados vão aparecer aqui.", fixEmpty: "Os temas a melhorar vão aparecer aqui.",
    detractors: "Detratores que precisam de você", detractorsSub: "Clientes insatisfeitos — fale com eles antes que sumam.",
    detractorsEmpty: "Nenhum cliente insatisfeito agora — sua experiência está saudável.",
    reconquer: "Gui reconquista", handled: "Gui está reconquistando ✓", mentions: "menções",
    window: "Últimos 30 dias", smallNote: "Amostra pequena — leia como sinais iniciais, não veredito.", of: "de",
    surveyTitle: "Pesquisa automática após cada visita", surveyDesc: "A Gui pergunta ao seu cliente um NPS/CSAT de 1 toque por email após a visita. Ligada por padrão — desligue quando quiser.",
    on: "Ligada", off: "Desligada", surveyOnMsg: "Pesquisa automática ligada ✓", surveyOffMsg: "Pesquisa automática desligada",
  },
  es: {
    title: "Experiencia del Cliente", sub: "Cómo se sienten tus clientes — medido en cada llamada, mensaje y reseña.",
    live: "EN VIVO — datos reales", sample: "Datos de ejemplo — conecta tu cuenta para ver tu score real de experiencia.", est: "estimación",
    cx: "Score de Experiencia", nps: "NPS", csat: "CSAT", collecting: "Recolectando…", collectingBody: "El feedback aparece aquí a medida que tus clientes responden.",
    vsPrior: "vs. 30d anteriores", sentiment: "Mezcla de sentimiento", pos: "Positivo", neu: "Neutral", neg: "Negativo",
    love: "Aman", fix: "Para mejorar", loveEmpty: "Los temas más elogiados aparecerán aquí.", fixEmpty: "Los temas a mejorar aparecerán aquí.",
    detractors: "Detractores que te necesitan", detractorsSub: "Clientes insatisfechos — contáctalos antes de que se vayan.",
    detractorsEmpty: "Ningún cliente insatisfecho ahora — tu experiencia está sana.",
    reconquer: "Gui reconquista", handled: "Gui está reconquistando ✓", mentions: "menciones",
    window: "Últimos 30 días", smallNote: "Muestra pequeña — léelo como señales tempranas, no veredicto.", of: "de",
    surveyTitle: "Encuesta automática tras cada visita", surveyDesc: "Gui pregunta a tu cliente un NPS/CSAT de 1 toque por email tras la visita. Activada por defecto — desactívala cuando quieras.",
    on: "Activada", off: "Desactivada", surveyOnMsg: "Encuesta automática activada ✓", surveyOffMsg: "Encuesta automática desactivada",
  },
};
const T = (k) => (STR[UI_LANG] || STR.en)[k] || STR.en[k] || k;

// Score → signal color: ≥70 done-green, ≥40 attention-amber, else alert (never a fake number — only tints a real one).
const scoreColor = (v) => (v >= 70 ? "#3E9468" : v >= 40 ? "#FFC23D" : "#e0855f");
const SMALL_N = 20; // below this, we flag "amostra pequena" honestly

// Deterministic demo payload (same per-sector flavor device as the other tabs' sample data).
function genExperienceDemo(V) {
  const L = V.label;
  const cx = vnum(L, "cx", 68, 88);
  const nps = vnum(L, "nps", 34, 72);
  const csat = vnum(L, "csat", 82, 96);
  const delta = vnum(L, "cxd", 0, 12) - 4; // -4..+8
  const pos = vnum(L, "spos", 58, 74), neg = vnum(L, "sneg", 4, 14), neu = Math.max(0, 100 - pos - neg);
  return {
    ready: true, demo: true, window: T("window"),
    cx_score: cx, cx_n: vnum(L, "cxn", 40, 180),
    nps, nps_n: vnum(L, "npsn", 30, 140),
    csat, csat_n: vnum(L, "csatn", 35, 160),
    trend: { delta, dir: delta >= 0 ? "up" : "down" },
    summary: { sentiment: { positive: pos, neutral: neu, negative: neg } },
    drivers: [
      { theme: "Atendimento rápido", count: vnum(L, "d1", 8, 22), kind: "love" },
      { theme: "Equipe atenciosa", count: vnum(L, "d2", 6, 18), kind: "love" },
      { theme: "Qualidade", count: vnum(L, "d3", 5, 14), kind: "love" },
      { theme: "Tempo de espera", count: vnum(L, "d4", 4, 12), kind: "fix" },
      { theme: "Preço", count: vnum(L, "d5", 3, 9), kind: "fix" },
    ],
    detractors: [
      { signal_id: "demo-1", name: "Ana R.", source: "Google", score: 2, comment: "Esperei mais do que o combinado.", at: new Date(Date.now() - 6 * 36e5).toISOString() },
      { signal_id: "demo-2", name: "Bruno T.", source: "WhatsApp", score: 3, comment: "Ficou bom mas o preço me surpreendeu.", at: new Date(Date.now() - 28 * 36e5).toISOString() },
    ],
  };
}

// One stat block in the hero. Shows the number + honest n; when n==0 / not ready → warm collecting state.
function HeroStat({ label, value, n, format = "score", color }) {
  const has = Number.isFinite(value) && (n == null || n > 0);
  const c = color || scoreColor(format === "nps" ? (Number(value) + 100) / 2 : Number(value));
  return (
    <div className="flex-1 min-w-[130px] px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-g-muted">{label}</div>
      {has ? (
        <>
          <div className="mt-1 text-4xl font-black num leading-none" style={{ color, textShadow: `0 0 18px ${c}44` }}>
            <Count key={`${label}-${value}`} to={Number(value)} suffix={format === "csat" ? "%" : ""} />
          </div>
          {Number.isFinite(n) && <div className="mt-1 text-[10px] text-g-muted num">n={n}</div>}
        </>
      ) : (
        <div className="mt-1">
          <div className="text-lg font-black text-g-gold">{T("collecting")}</div>
          <div className="text-[10px] text-g-muted mt-0.5 max-w-[150px] leading-snug">{T("collectingBody")}</div>
        </div>
      )}
    </div>
  );
}

function Experience({ V, real = null, email = "", dataKey = "" }) {
  const dk = dataKey || loadDataKey();
  const [data, setData] = useState(null);      // null = fetch in flight (real mode)
  const [handled, setHandled] = useState({});  // signal_id → true (optimistic close-loop)
  const [surveyOn, setSurveyOn] = useState(null); // active-survey toggle (null until data loads)
  useEffect(() => { if (data && typeof data.survey_enabled === "boolean") setSurveyOn(data.survey_enabled); }, [data]);

  useEffect(() => {
    let alive = true;
    if (!real || !email || !dk) { setData(null); return; }
    fetch("/api/experience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, dataKey: dk }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setData(j || { ready: false }); })
      .catch(() => { if (alive) setData({ ready: false }); });
    return () => { alive = false; };
  }, [real, email, dk]);

  const demo = !real;
  // Real mode, fetch still in flight → skeleton (never a false "all clear" / fake score).
  if (real && data === null) return <SectionSkeleton rows={5} />;

  const d = demo ? genExperienceDemo(V) : (data || { ready: false });
  const ready = !!d.ready;

  const cx = Number(d.cx_score), nps = Number(d.nps), csat = Number(d.csat);
  const cxN = Number(d.cx_n) || 0, npsN = Number(d.nps_n) || 0, csatN = Number(d.csat_n) || 0;
  const maxN = Math.max(cxN, npsN, csatN);
  const small = ready && maxN > 0 && maxN < SMALL_N;

  const sent = d.summary?.sentiment || {};
  const sp = Math.max(0, Number(sent.positive) || 0), sn = Math.max(0, Number(sent.negative) || 0), su = Math.max(0, Number(sent.neutral) || 0);
  const sTot = sp + sn + su;
  const sentReady = sTot > 0;
  const pctP = sentReady ? (sp / sTot) * 100 : 0, pctN = sentReady ? (sn / sTot) * 100 : 0, pctU = sentReady ? (su / sTot) * 100 : 0;

  const drivers = Array.isArray(d.drivers) ? d.drivers : [];
  const love = drivers.filter((x) => x.kind === "love").sort((a, b) => (b.count || 0) - (a.count || 0));
  const fix = drivers.filter((x) => x.kind === "fix").sort((a, b) => (b.count || 0) - (a.count || 0));

  const detractors = (Array.isArray(d.detractors) ? d.detractors : []).filter((x) => !handled[x.signal_id]);

  const trend = d.trend || null;
  const tUp = trend && (trend.dir === "up" || Number(trend.delta) >= 0);
  const tDelta = trend ? Math.abs(Number(trend.delta) || 0) : 0;

  const reconquer = async (r) => {
    if (demo) return;
    setHandled((h) => ({ ...h, [r.signal_id]: true }));       // optimistic remove
    toast(T("handled"));
    try {
      const res = await fetch("/api/experience", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close_loop", signal_id: r.signal_id, email, dataKey: dk }),
      });
      const j = res.ok ? await res.json() : null;
      if (!j || !j.ok) { setHandled((h) => { const n = { ...h }; delete n[r.signal_id]; return n; }); toast("Não consegui salvar — tente de novo."); }
    } catch { setHandled((h) => { const n = { ...h }; delete n[r.signal_id]; return n; }); toast("Não consegui salvar — tente de novo."); }
  };

  const surveyEnabled = demo ? true : (surveyOn == null ? (d.survey_enabled !== false) : surveyOn);
  const saveSurvey = async (next) => {
    if (demo) return;
    setSurveyOn(next);                                          // optimistic
    try {
      const res = await fetch("/api/experience", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_survey", enabled: next, email, dataKey: dk }),
      });
      const j = res.ok ? await res.json() : null;
      if (!j || !j.ok) { setSurveyOn(!next); toast("Não consegui salvar — tente de novo."); }
      else { toast(next ? T("surveyOnMsg") : T("surveyOffMsg")); }
    } catch { setSurveyOn(!next); toast("Não consegui salvar — tente de novo."); }
  };

  return (
    <div className="space-y-4 stagger">
      {/* HERO — the three headline numbers, each with an honest sample size */}
      <div className="rounded-2xl border border-[#5B9BD5]/25 bg-gradient-to-br from-[#5B9BD5]/[0.08] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#5B9BD5" }}>
          <FaFaceSmile size={12} /> {T("title")}
          {real
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{T("live")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{T("est")}</span>}
        </div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{T("sub")}</p>

        <div className="mt-3 rounded-xl2 border border-white/10 bg-white/[0.03] divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06] flex flex-col sm:flex-row">
          <HeroStat label={T("cx")} value={cx} n={cxN} format="score" color={scoreColor(cx)} />
          <HeroStat label={T("nps")} value={nps} n={npsN} format="nps" color={scoreColor((nps + 100) / 2)} />
          <HeroStat label={T("csat")} value={csat} n={csatN} format="csat" color={scoreColor(csat)} />
        </div>

        {/* TREND — delta vs prior 30d */}
        {ready && trend && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: tUp ? "#3E9468" : "#e0855f" }}>
            {tUp ? <FaArrowTrendUp size={11} /> : <FaArrowTrendDown size={11} />}
            <span className="num">{tUp ? "+" : "−"}{tDelta}</span>
            <span className="text-g-muted font-normal">{T("vsPrior")}</span>
          </div>
        )}
      </div>

      {/* ACTIVE SURVEY TOGGLE — Gui asks customers 1-tap NPS/CSAT by email after a visit. ON by default. */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-black text-g-word">{T("surveyTitle")}</div>
          <div className="text-[11px] text-g-muted leading-snug mt-0.5">{T("surveyDesc")}</div>
        </div>
        <button
          type="button" disabled={demo}
          onClick={() => saveSurvey(!surveyEnabled)}
          aria-pressed={surveyEnabled}
          title={surveyEnabled ? T("on") : T("off")}
          className="relative shrink-0 h-7 w-[52px] rounded-full transition-colors disabled:opacity-50 min-h-[44px] inline-flex items-center"
          style={{ background: surveyEnabled ? "#3E9468" : "rgba(255,255,255,0.12)" }}
        >
          <span className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: surveyEnabled ? "26px" : "4px" }} />
        </button>
      </div>

      {demo && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {T("sample")}
        </div>
      )}

      {/* SENTIMENT MIX — slim pos/neu/neg bar */}
      <Card>
        <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-2.5">{T("sentiment")}</div>
        {sentReady ? (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.05]">
              {pctP > 0 && <div style={{ width: `${pctP}%`, background: "#3E9468" }} title={`${T("pos")} ${Math.round(pctP)}%`} />}
              {pctU > 0 && <div style={{ width: `${pctU}%`, background: "#8B857A" }} title={`${T("neu")} ${Math.round(pctU)}%`} />}
              {pctN > 0 && <div style={{ width: `${pctN}%`, background: "#e0855f" }} title={`${T("neg")} ${Math.round(pctN)}%`} />}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#3E9468" }} /><span className="text-g-word num">{Math.round(pctP)}%</span> <span className="text-g-muted font-normal">{T("pos")}</span></span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#8B857A" }} /><span className="text-g-word num">{Math.round(pctU)}%</span> <span className="text-g-muted font-normal">{T("neu")}</span></span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#e0855f" }} /><span className="text-g-word num">{Math.round(pctN)}%</span> <span className="text-g-muted font-normal">{T("neg")}</span></span>
            </div>
          </>
        ) : (
          <Empty icon="🌿" text={T("collectingBody")} />
        )}
      </Card>

      {/* DRIVERS — two columns: Amam (love) / Pra melhorar (fix) */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card tone="green">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-g-green mb-2.5"><FaHeart size={11} /> {T("love")}</div>
          {love.length ? (
            <div className="space-y-2">{love.map((x, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-g-word truncate">{x.theme}</span>
                <span className="shrink-0 text-[11px] font-black num text-g-green">{x.count} <span className="text-g-muted font-normal">{T("mentions")}</span></span>
              </div>
            ))}</div>
          ) : <Empty icon="🌿" text={T("loveEmpty")} />}
        </Card>
        <Card tone="red">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: "#e0855f" }}><FaScrewdriverWrench size={11} /> {T("fix")}</div>
          {fix.length ? (
            <div className="space-y-2">{fix.map((x, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-g-word truncate">{x.theme}</span>
                <span className="shrink-0 text-[11px] font-black num" style={{ color: "#e0855f" }}>{x.count} <span className="text-g-muted font-normal">{T("mentions")}</span></span>
              </div>
            ))}</div>
          ) : <Empty icon="🌿" text={T("fixEmpty")} />}
        </Card>
      </div>

      {/* DETRATORES QUE PRECISAM DE VOCÊ — close-the-loop list */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#e0855f" }}>{T("detractors")}</div>
          <div className="text-[11px] text-g-muted mt-0.5">{T("detractorsSub")}</div>
        </div>
        {detractors.length ? (
          <div className="divide-y divide-white/[0.05]">
            {detractors.map((r, i) => (
              <div key={r.signal_id || i} style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }} className="row-in px-5 py-3">
                <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                  <span className="grid place-items-center h-9 w-9 rounded-full shrink-0 text-sm font-black num" style={{ background: "#e0855f1e", color: "#e0855f", boxShadow: "inset 0 0 0 1px #e0855f44" }}>{Number.isFinite(Number(r.score)) ? Number(r.score) : "!"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">
                      {r.name || "Cliente"}
                      {r.source ? <span className="text-g-muted font-normal"> · {r.source}</span> : null}
                      {r.at ? <span className="text-g-muted font-normal"> · {relTime(r.at)}</span> : null}
                    </div>
                    {r.comment ? <div className="text-[13px] text-g-muted mt-0.5 leading-snug">“{r.comment}”</div> : null}
                  </div>
                  <button onClick={() => reconquer(r)} disabled={demo}
                    title={demo ? T("sample") : undefined}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition disabled:opacity-45 disabled:cursor-not-allowed"
                    style={{ borderColor: "#FF8A3355", background: "#FF8A3312", color: "#FF8A33" }}>
                    <FaHandHoldingHeart size={11} /> {T("reconquer")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon="💚" text={T("detractorsEmpty")} />
        )}
      </Card>

      {/* honest footer — data window + small-sample caveat */}
      <div className="px-1 text-[11px] text-g-muted flex flex-wrap items-center gap-x-2 gap-y-1">
        <FaStar size={9} className="opacity-60" />
        <span>{d.window || T("window")}</span>
        {small && <span className="text-g-gold font-bold">· {T("smallNote")}</span>}
      </div>
    </div>
  );
}

export default Experience;
