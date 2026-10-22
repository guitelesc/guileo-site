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
    // 6 chaves deste bloco EN estavam em português ("Coletando…", "Amam", "Pra melhorar",
    // "Detratores…", "Gui reconquista", "Gui está reconquistando") — um dono em inglês via PT no meio da tela.
    cx: "Experience Score", nps: "NPS", csat: "CSAT", collecting: "Collecting…", collectingBody: "Feedback shows here as your customers respond.",
    vsPrior: "vs prior 30d", sentiment: "Sentiment mix", pos: "Positive", neu: "Neutral", neg: "Negative",
    love: "They love", fix: "To improve", loveEmpty: "The themes customers praise most will appear here.", fixEmpty: "The themes to fix will appear here.",
    detractors: "Detractors who need you", detractorsSub: "Unhappy customers — reach them before they churn.",
    detractorsEmpty: "No unhappy customers right now — your experience is healthy.",
    // 🚨 O BOTÃO DIZ O QUE FAZ (2026-09-28). Era "Gui wins them back" / "Gui is winning them back ✓":
    // a ação só MARCA o sinal como tratado (cx_close_loop) — nenhuma mensagem sai, ninguém é
    // procurado. A dona clicava, lia "winning them back" e deixava de ligar para a cliente.
    reconquer: "Mark as handled", handled: "Marked as handled ✓ — no message was sent. Reach out to them yourself.", mentions: "mentions",
    // a janela do servidor é de 90 dias (cx_summary/cx_drivers); o rodapé dizia 30.
    window: "Last 90 days", smallNote: "Small sample — read these as early signals, not verdicts.", of: "of",
    saveFail: "Couldn't save — try again.", customer: "Customer",
    failTitle: "I couldn't read your customer experience just now.", failBody: "This is a reading failure — it does not mean everything is fine.", retry: "↻ Try again",
    notReady: "Not measured yet — this list fills in as feedback comes in.",
    dLove1: "Fast service", dLove2: "Attentive team", dLove3: "Quality", dFix1: "Waiting time", dFix2: "Price",
    dC1: "I waited longer than we agreed.", dC2: "It turned out well, but the price surprised me.",
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
    reconquer: "Marcar como tratado", handled: "Marcado como tratado ✓ — nenhuma mensagem foi enviada. Fale você com o cliente.", mentions: "menções",
    window: "Últimos 90 dias", smallNote: "Amostra pequena — leia como sinais iniciais, não veredito.", of: "de",
    saveFail: "Não consegui salvar — tente de novo.", customer: "Cliente",
    failTitle: "Não consegui ler a experiência dos seus clientes agora.", failBody: "Isto é uma falha de leitura — não quer dizer que está tudo bem.", retry: "↻ Tentar de novo",
    notReady: "Ainda não medido — a lista se preenche conforme o feedback chega.",
    dLove1: "Atendimento rápido", dLove2: "Equipe atenciosa", dLove3: "Qualidade", dFix1: "Tempo de espera", dFix2: "Preço",
    dC1: "Esperei mais do que o combinado.", dC2: "Ficou bom, mas o preço me surpreendeu.",
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
    reconquer: "Marcar como atendido", handled: "Marcado como atendido ✓ — no se envió ningún mensaje. Contacta tú al cliente.", mentions: "menciones",
    window: "Últimos 90 días", smallNote: "Muestra pequeña — léelo como señales tempranas, no veredicto.", of: "de",
    saveFail: "No pude guardar — inténtalo de nuevo.", customer: "Cliente",
    failTitle: "No pude leer la experiencia de tus clientes ahora.", failBody: "Esto es un fallo de lectura — no significa que todo esté bien.", retry: "↻ Intentar de nuevo",
    notReady: "Aún no medido — la lista se llena a medida que llega el feedback.",
    dLove1: "Atención rápida", dLove2: "Equipo atento", dLove3: "Calidad", dFix1: "Tiempo de espera", dFix2: "Precio",
    dC1: "Esperé más de lo acordado.", dC2: "Quedó bien, pero el precio me sorprendió.",
    surveyTitle: "Encuesta automática tras cada visita", surveyDesc: "Gui pregunta a tu cliente un NPS/CSAT de 1 toque por email tras la visita. Activada por defecto — desactívala cuando quieras.",
    on: "Activada", off: "Desactivada", surveyOnMsg: "Encuesta automática activada ✓", surveyOffMsg: "Encuesta automática desactivada",
  },
  // hi faltava: o 4º idioma da UI caía em inglês nesta tela. Números/NPS/CSAT ficam como estão.
  hi: {
    title: "ग्राहक अनुभव", sub: "आपके ग्राहक कैसा महसूस करते हैं — हर कॉल, संदेश और समीक्षा में मापा गया।",
    live: "लाइव — असली डेटा", sample: "नमूना डेटा — अपना असली अनुभव स्कोर देखने के लिए खाता कनेक्ट करें।", est: "अनुमान",
    cx: "अनुभव स्कोर", nps: "NPS", csat: "CSAT", collecting: "एकत्र हो रहा है…", collectingBody: "जैसे-जैसे ग्राहक जवाब देते हैं, फ़ीडबैक यहाँ दिखता है।",
    vsPrior: "पिछले 30 दिनों की तुलना में", sentiment: "भावना का मिश्रण", pos: "सकारात्मक", neu: "तटस्थ", neg: "नकारात्मक",
    love: "पसंद करते हैं", fix: "सुधार के लिए", loveEmpty: "ग्राहक जिन बातों की सबसे ज़्यादा तारीफ़ करते हैं, वे यहाँ दिखेंगी।", fixEmpty: "सुधारने वाली बातें यहाँ दिखेंगी।",
    detractors: "ऐसे असंतुष्ट ग्राहक जिन्हें आपकी ज़रूरत है", detractorsSub: "नाखुश ग्राहक — उनके जाने से पहले उनसे संपर्क करें।",
    detractorsEmpty: "अभी कोई नाखुश ग्राहक नहीं — आपका अनुभव स्वस्थ है।",
    reconquer: "निपटाया हुआ चिह्नित करें", handled: "निपटाया हुआ चिह्नित ✓ — कोई संदेश नहीं भेजा गया। ग्राहक से आप स्वयं संपर्क करें।", mentions: "उल्लेख",
    window: "पिछले 90 दिन", smallNote: "छोटा नमूना — इन्हें शुरुआती संकेत मानें, फ़ैसला नहीं।", of: "में से",
    saveFail: "सहेज नहीं सका — फिर कोशिश करें।", customer: "ग्राहक",
    failTitle: "अभी आपके ग्राहकों का अनुभव नहीं पढ़ सका।", failBody: "यह पढ़ने की विफलता है — इसका मतलब यह नहीं कि सब ठीक है।", retry: "↻ फिर कोशिश करें",
    notReady: "अभी मापा नहीं गया — फ़ीडबैक आने पर यह सूची भरती है।",
    dLove1: "तेज़ सेवा", dLove2: "ध्यान रखने वाली टीम", dLove3: "गुणवत्ता", dFix1: "प्रतीक्षा समय", dFix2: "कीमत",
    dC1: "तय समय से ज़्यादा इंतज़ार करना पड़ा।", dC2: "काम अच्छा हुआ, पर कीमत ने चौंका दिया।",
    surveyTitle: "हर विज़िट के बाद स्वचालित सर्वे", surveyDesc: "विज़िट के बाद Gui आपके ग्राहक से ईमेल पर 1-टैप NPS/CSAT पूछती है। डिफ़ॉल्ट रूप से चालू — कभी भी बंद करें।",
    on: "चालू", off: "बंद", surveyOnMsg: "स्वचालित सर्वे चालू ✓", surveyOffMsg: "स्वचालित सर्वे बंद",
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
      { theme: T("dLove1"), count: vnum(L, "d1", 8, 22), kind: "love" },
      { theme: T("dLove2"), count: vnum(L, "d2", 6, 18), kind: "love" },
      { theme: T("dLove3"), count: vnum(L, "d3", 5, 14), kind: "love" },
      { theme: T("dFix1"), count: vnum(L, "d4", 4, 12), kind: "fix" },
      { theme: T("dFix2"), count: vnum(L, "d5", 3, 9), kind: "fix" },
    ],
    detractors: [
      { signal_id: "demo-1", name: "Ana R.", source: "Google", score: 2, comment: T("dC1"), at: new Date(Date.now() - 6 * 36e5).toISOString() },
      { signal_id: "demo-2", name: "Bruno T.", source: "WhatsApp", score: 3, comment: T("dC2"), at: new Date(Date.now() - 28 * 36e5).toISOString() },
    ],
  };
}

// One stat block in the hero. Shows the number + honest n; when n==0 / not ready → warm collecting state.
function HeroStat({ label, value, n, format = "score", color, animar = false }) {
  const has = Number.isFinite(value) && (n == null || n > 0);
  const c = color || scoreColor(format === "nps" ? (Number(value) + 100) / 2 : Number(value));
  return (
    <div className="flex-1 min-w-[130px] px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-g-muted">{label}</div>
      {has ? (
        <>
          <div className="mt-1 text-4xl font-black num leading-none" style={{ color, textShadow: `0 0 18px ${c}44` }}>
            {/* conta real: o número nasce no valor (contador animado congela em 0 numa aba de fundo) */}
            {animar ? <Count key={`${label}-${value}`} to={Number(value)} suffix={format === "csat" ? "%" : ""} /> : <>{Math.round(Number(value))}{format === "csat" ? "%" : ""}</>}
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
  const [seq, setSeq] = useState(0);              // "tentar de novo" refaz a leitura
  useEffect(() => { if (data && typeof data.survey_enabled === "boolean") setSurveyOn(data.survey_enabled); }, [data]);

  // 🚨 FALHA DE LEITURA VIRAVA "SUA EXPERIÊNCIA ESTÁ SAUDÁVEL" (2026-09-28). Um 500 ou a rede
  // caída viravam `{ready:false}`, e a tela desenhava a lista de detratores VAZIA com a frase
  // "No unhappy customers right now — your experience is healthy". A dona com uma cliente
  // insatisfeita esperando retorno lia um "tudo certo" que ninguém apurou. Falha agora é `falha`,
  // com aviso e nova tentativa; e "saudável" só aparece quando a camada está medindo (`ready`).
  useEffect(() => {
    let alive = true;
    if (!real || !email || !dk) { setData(null); return; }
    setData(null);
    fetch("/api/experience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, dataKey: dk }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setData(j && typeof j === "object" && !j.error && !j.erro ? j : { falha: true }); })
      .catch(() => { if (alive) setData({ falha: true }); });
    return () => { alive = false; };
  }, [real, email, dk, seq]);

  const demo = !real;
  // Real mode, fetch still in flight → skeleton (never a false "all clear" / fake score).
  if (real && data === null) return <SectionSkeleton rows={5} />;
  if (real && data && data.falha) {
    return (
      <Card className="text-center py-10">
        <div className="text-2xl">📡</div>
        <div className="mt-2 text-sm font-bold text-g-word">{T("failTitle")}</div>
        <div className="text-xs text-g-muted mt-0.5">{T("failBody")}</div>
        <button onClick={() => setSeq((n) => n + 1)} className="btn-bright text-sm mt-4">{T("retry")}</button>
      </Card>
    );
  }

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
    const desfaz = () => setHandled((h) => { const n = { ...h }; delete n[r.signal_id]; return n; });
    try {
      const res = await fetch("/api/experience", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // `note` é o que fica gravado no sinal: "reconquista" (o padrão do servidor) afirmava uma
        // ação que não houve. O registro diz o que foi feito — marcado à mão, pelo painel.
        body: JSON.stringify({ action: "close_loop", signal_id: r.signal_id, email, dataKey: dk, note: "marked handled in the Central" }),
      });
      const j = res.ok ? await res.json() : null;
      // o toast só sai DEPOIS do ok do servidor — antes ele saía junto com o clique
      if (!j || !j.ok) { desfaz(); toast(T("saveFail")); } else toast(T("handled"));
    } catch { desfaz(); toast(T("saveFail")); }
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
      if (!j || !j.ok) { setSurveyOn(!next); toast(T("saveFail")); }
      else { toast(next ? T("surveyOnMsg") : T("surveyOffMsg")); }
    } catch { setSurveyOn(!next); toast(T("saveFail")); }
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
          <HeroStat animar={demo} label={T("cx")} value={cx} n={cxN} format="score" color={scoreColor(cx)} />
          <HeroStat animar={demo} label={T("nps")} value={nps} n={npsN} format="nps" color={scoreColor((nps + 100) / 2)} />
          <HeroStat animar={demo} label={T("csat")} value={csat} n={csatN} format="csat" color={scoreColor(csat)} />
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
                <span className="text-sm font-bold text-g-word truncate">{String(x.theme || "").replace(/_/g, " ")}</span>
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
                <span className="text-sm font-bold text-g-word truncate">{String(x.theme || "").replace(/_/g, " ")}</span>
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
                      {r.name || T("customer")}
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
          <Empty icon={ready ? "💚" : "🌿"} text={ready ? T("detractorsEmpty") : T("notReady")} />
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
