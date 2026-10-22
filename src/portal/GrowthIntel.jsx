/* Inteligência tab — GROWTH INTELLIGENCE in the cockpit.
   Four honest lenses on the "motor de crescimento PERSONALIZADO":
     • LTV — quanto vale cada cliente (top clientes + média)  → recorrência é a alavanca
     • Origem — de onde os clientes vêm (atribuição por lead_source + conversão)
     • Previsão 7 dias — bookings/receita esperados (média das últimas 4 semanas)
     • Agendamentos abandonados — quem quase agendou, com 1-clique "Gui chama de volta"
   Backend: /api/growth-intel (ltv/sources/forecast/abandoned/recover → growth_intel.sql RPCs).
   Demo mode = deterministic sample per sector; real mode = live per-tenant data + skeletons. */
import { useState, useEffect } from "react";
import { FaChartLine, FaUsers, FaArrowTrendUp, FaCartArrowDown, FaPhoneVolume, FaCheck, FaHeartCrack, FaCommentSms, FaUserClock } from "react-icons/fa6";
import { toast, chamarApi } from "../lib/portalApi.js";
import { tr, Card, Empty, SectionSkeleton, UI_LANG, vnum } from "../pages/Portal.jsx";
import FalhaDeLeitura, { fraseDaFalha } from "./FalhaDeLeitura.jsx";

const LOCALE = () => (UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US");
const money = (cents) => {
  const v = (Number(cents) || 0) / 100;
  try { return new Intl.NumberFormat(LOCALE(), { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }
  catch { return `$${Math.round(v)}`; }
};

// ── shared POST helper. Devolve {data, motivo} e nunca levanta; `lang` vai em toda chamada. ──
const giPost = (body) => chamarApi("/api/growth-intel", { ...body, lang: UI_LANG });

// 🚨 (2026-09-28) CADA LENTE TEM TRÊS ESTADOS: ok · off (servidor disse "ainda não ligado") ·
// falha (não consegui ler). A tela juntava as cinco respostas com OU (`ltvR?.ready || srcR?.ready
// || …`): bastava UMA lente responder para as outras quatro, mesmo falhando, desenharem seus
// vazios como fato — "No one at risk of drifting away", "$0 LTV total", "0 abandoned". E com as
// cinco falhando, a tela dizia "Intelligence is warming up", que é o estado de conta nova.
const lente = (r, campo, ehLista) => {
  if (r.motivo) return { estado: "falha", motivo: r.motivo, v: ehLista ? [] : null };
  const d = r.data;
  if (d.ok === false) return { estado: "falha", motivo: "servidor", v: ehLista ? [] : null };   // 200 + ok:false = falhou lá dentro
  if (d.ready !== true) return { estado: "off", v: ehLista ? [] : null };
  const v = d[campo];
  if (ehLista ? !Array.isArray(v) : !(v && typeof v === "object")) return { estado: "falha", motivo: "resposta_estranha", v: ehLista ? [] : null };
  return { estado: "ok", v: ehLista ? v.filter(Boolean) : v };
};

// ── deterministic demo data (same per-sector flavor as the other tabs) ──
function genDemo(V) {
  const names = ["Ana R.", "Bruno T.", "Carla M.", "Diego P.", "Sofia L.", "Marco V.", "Lia F."];
  const top = names.slice(0, 6).map((name, i) => ({
    name, lifecycle: ["vip", "loyal", "loyal", "active", "active", "active"][i],
    visit_count: vnum(V.label, `gtv${i}`, 3, 22),
    ltv_cents: [148000, 96000, 71000, 52000, 38000, 24000][i],
  }));
  const total = top.reduce((s, t) => s + t.ltv_cents, 0) * 4;
  const ltv = { total_ltv_cents: total, contact_count: vnum(V.label, "gc", 80, 340), paying_count: vnum(V.label, "gp", 40, 180),
    avg_ltv_cents: Math.round(total / vnum(V.label, "gp", 40, 180)), appt_revenue_cents: total, top };
  const sources = [
    { source: tr("Instagram"), total: vnum(V.label, "s0", 30, 90), conv_pct: 44 },
    { source: "Google", total: vnum(V.label, "s1", 20, 70), conv_pct: 38 },
    { source: tr("Referral"), total: vnum(V.label, "s2", 15, 50), conv_pct: 61 },
    { source: tr("direct"), total: vnum(V.label, "s3", 10, 40), conv_pct: 29 },
  ].map((s) => ({ ...s, converted: Math.round(s.total * s.conv_pct / 100) })).sort((a, b) => b.total - a.total);
  const bk = vnum(V.label, "fb", 40, 120);
  const forecast = { bookings_4w: bk, revenue_4w_cents: bk * 8500, expected_bookings_7d: Math.round(bk / 4),
    expected_revenue_7d_cents: Math.round(bk * 8500 / 4), already_booked_7d: Math.round(bk / 8) };
  const abandoned = [
    { id: "demo-0", name: "Renata C.", contact: "+1 (305) 555-0142", service: tr("Booking"), source: "widget", minutes_ago: 42, claimed: false },
    { id: "demo-1", name: "", contact: "+1 (646) 555-0199", service: "", source: "webchat", minutes_ago: 88, claimed: false },
    { id: "demo-2", name: "Tiago M.", contact: "tiago@email.com", service: tr("Booking"), source: "landing", minutes_ago: 176, claimed: true },
  ];
  const atRisk = [
    { name: "Marco V.", phone: "+1 (305) 555-0188", risk: 92, days_since_visit: 61, usual_cadence_days: 21, visits: 9, ltv: 1180, suggested_action: "call" },
    { name: "Carla M.", phone: "+1 (646) 555-0164", risk: 74, days_since_visit: 44, usual_cadence_days: 18, visits: 6, ltv: 710, suggested_action: "sms" },
    { name: "Diego P.", phone: "+1 (718) 555-0132", risk: 58, days_since_visit: 33, usual_cadence_days: 15, visits: 4, ltv: 520, suggested_action: "sms" },
  ];
  return { ltv, sources, forecast, abandoned, atRisk };
}

function Metric({ label, value, sub, color = "#FF8A33", icon }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-g-muted">
        {icon} {label}
      </div>
      <div className="mt-1.5 text-2xl font-black num" style={{ color }}>{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-g-muted">{sub}</div> : null}
    </div>
  );
}

const lifeColor = (l) => l === "vip" ? "#FF4FA3" : l === "loyal" ? "#FF8A33" : l === "active" ? "#3E9468" : "#9A8F82";

function GrowthIntel({ V, real = null, email = "", dataKey = "" }) {
  const [data, setData] = useState(null);          // null = loading (real mode)
  const [recovered, setRecovered] = useState({});  // intent_id → true (optimistic)
  const [tentativa, setTentativa] = useState(0);
  const demo = !real;

  useEffect(() => {
    let alive = true;
    if (!real) return;
    // conta real sem e-mail/chave: o efeito saía calado e a tela era esqueleto para sempre
    if (!email || !dataKey) { const f = { estado: "falha", motivo: "sem_credencial" }; setData({ L: { ltv: f, sources: f, forecast: f, abandoned: f, atRisk: f }, ltv: null, sources: [], forecast: null, abandoned: [], atRisk: [] }); return; }
    setData(null);
    (async () => {
      const [ltvR, srcR, fcR, abR, chR] = await Promise.all([
        giPost({ action: "ltv", token: dataKey, email }),
        giPost({ action: "sources", token: dataKey, email }),
        giPost({ action: "forecast", token: dataKey, email }),
        giPost({ action: "abandoned", token: dataKey, email }),
        giPost({ action: "churn", token: dataKey, email }),
      ]);
      if (!alive) return;
      const L = {
        ltv: lente(ltvR, "ltv", false), sources: lente(srcR, "sources", true), forecast: lente(fcR, "forecast", false),
        abandoned: lente(abR, "intents", true), atRisk: lente(chR, "atRisk", true),
      };
      setData({ L, ltv: L.ltv.v, sources: L.sources.v, forecast: L.forecast.v, abandoned: L.abandoned.v, atRisk: L.atRisk.v });
    })();
    return () => { alive = false; };
  }, [real, email, dataKey, tentativa]);
  const tentarDeNovo = () => setTentativa((n) => n + 1);

  const doRecover = async (r) => {
    setRecovered((s) => ({ ...s, [r.id]: true }));                  // optimistic (só a LINHA)
    const res = await giPost({ action: "recover", token: dataKey, email, intent_id: r.id, name: r.name || "", contact: r.contact || "" });
    const d = res.motivo ? null : res.data;
    if (!d || !d.ok || !d.claimed) {
      setRecovered((s) => { const n = { ...s }; delete n[r.id]; return n; });
      toast(`${tr("Couldn't save that — try again.")}${res.motivo ? ` ${fraseDaFalha(res.motivo)}` : ""}`);
      return;
    }
    // O "✓" só sai DEPOIS do comprovante. Antes ele saía na hora do clique e, se a gravação
    // falhasse, a pessoa já tinha lido que a Gui ia ligar.
    toast(tr("Gui will call back — it shows up in your feed ✓"));
  };

  const [reengaged, setReengaged] = useState({}); // phone → true (optimistic)
  const doReengage = async (c) => {
    const id = c.phone || c.contact_email || c.name;
    setReengaged((s) => ({ ...s, [id]: true }));                       // optimistic row state
    const r0 = await giPost({ action: "reengage", token: dataKey, email, name: c.name || "", contact: c.phone || c.contact_email || "", suggested: c.suggested_action || "sms", risk: c.risk });
    const res = r0.motivo ? null : r0.data;
    if (!res || !res.ok || !res.queued) {
      setReengaged((s) => { const n = { ...s }; delete n[id]; return n; });
      toast(`${tr("Couldn't save that — try again.")}${r0.motivo ? ` ${fraseDaFalha(r0.motivo)}` : ""}`);
      return;
    }
    // Surface the GENUINE win from the backend (via/sent) — not a generic toast.
    // res.sent === true only when Gui actually delivered a branded email right now.
    const who = c.name || tr("customer");
    if (res.sent) toast(`${tr("Gui reached")} ${who} ${tr("by email just now ✓")}`);
    else if ((res.via || c.suggested_action) === "call") toast(`${tr("Gui will call")} ${who} — ${tr("queued ✓")}`);
    else toast(`${tr("Gui will text")} ${who} — ${tr("queued ✓")}`);
  };

  // real mode, fetch in flight → skeleton (never a false empty state)
  if (real && data === null) return <SectionSkeleton rows={6} />;

  const D = demo ? genDemo(V) : data;
  const ltv = D.ltv, sources = D.sources || [], forecast = D.forecast, abandoned = D.abandoned || [], atRisk = D.atRisk || [];
  // estado de cada lente (em demo tudo é "ok": a amostra está completa por construção)
  const OKL = { estado: "ok" };
  const L = demo ? { ltv: OKL, sources: OKL, forecast: OKL, abandoned: OKL, atRisk: OKL } : data.L;
  const lentes = Object.values(L);
  const falhas = lentes.filter((x) => x.estado === "falha");
  // "aquecendo" = o servidor respondeu às cinco e nenhuma está ligada. Falha nunca cai aqui.
  const notReady = real && falhas.length === 0 && lentes.every((x) => x.estado === "off");
  const tudoFalhou = real && falhas.length === lentes.length;
  // número de lente que não foi lida é "—", nunca 0 / $0
  const n = (lt, v) => (lt.estado === "ok" ? v : "—");
  const Aviso = ({ lt, titulo }) => (lt.estado === "falha"
    ? <div className="px-5 py-4"><FalhaDeLeitura compacto motivo={lt.motivo} onRetry={tentarDeNovo} titulo={titulo} /></div>
    : <div className="px-5 py-6 text-center text-[11px] text-g-muted">{tr("Not measured for your account yet.")}</div>);

  return (
    <div className="space-y-4 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          <FaChartLine size={11} /> {tr("Growth Intelligence")}
          {real
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("What each customer is worth, where they come from, and what's coming next.")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Recurrence is the biggest lever — recover who almost booked and bring the customer back.")}</p>
      </div>

      {demo && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Sample data — connect your account to see your real growth intelligence.")}
        </div>
      )}

      {notReady && (
        <Card><Empty icon="📡" text={tr("Intelligence is warming up — it turns on as soon as your customers and bookings come in.")} /></Card>
      )}
      {tudoFalhou && <FalhaDeLeitura motivo={falhas[0].motivo} onRetry={tentarDeNovo} titulo={tr("I couldn't load your growth intelligence just now.")} />}
      {!tudoFalhou && falhas.length > 0 && <FalhaDeLeitura compacto motivo={falhas[0].motivo} onRetry={tentarDeNovo} titulo={tr("Part of this page didn't load — the blocks marked below are missing, not empty.")} />}

      {/* LTV */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label={tr("Total LTV")} value={n(L.ltv, money(ltv?.total_ltv_cents))} sub={L.ltv.estado === "ok" ? `${ltv?.contact_count || 0} ${tr("customers")}` : ""} color="#FF8A33" icon={<FaUsers size={10} />} />
        <Metric label={tr("Average ticket (LTV)")} value={n(L.ltv, money(ltv?.avg_ltv_cents))} sub={L.ltv.estado === "ok" ? `${ltv?.paying_count || 0} ${tr("paying")}` : ""} color="#FF8A33" icon={<FaChartLine size={10} />} />
        <Metric label={tr("7-day forecast")} value={forecast && L.forecast.estado === "ok" ? `${forecast.expected_bookings_7d} ${tr("bookings")}` : "—"} sub={forecast && L.forecast.estado === "ok" ? money(forecast.expected_revenue_7d_cents) : ""} color="#3E9468" icon={<FaArrowTrendUp size={10} />} />
        <Metric label={tr("Abandoned")} value={n(L.abandoned, `${abandoned.filter((a) => !a.claimed && !recovered[a.id]).length}`)} sub={L.abandoned.estado === "ok" ? tr("to recover") : ""} color="#FFC23D" icon={<FaCartArrowDown size={10} />} />
      </div>

      {/* Clientes prestes a sumir — churn radar, 1-clique Gui reativa */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: "#FF4FA3" }}><FaHeartCrack size={11} /> {tr("Customers about to drift away")}</span>
          <span className="text-[11px] text-g-muted hidden sm:inline">{tr("gone longer than usual — 1 tap and Gui reactivates")}</span>
        </div>
        {L.atRisk.estado !== "ok" ? (
          <Aviso lt={L.atRisk} titulo={tr("I couldn't load who is at risk.")} />
        ) : atRisk.length === 0 ? (
          <Empty icon="💚" text={tr("No one at risk of drifting away — your base is coming back at its own pace.")} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {atRisk.map((c, i) => {
              const id = c.phone || c.contact_email || c.name;
              const gone = reengaged[id];
              const rk = Number(c.risk) || 0;
              const rColor = rk >= 80 ? "#FF4FA3" : rk >= 55 ? "#FFC23D" : "#9A8F82";
              return (
                <div key={id || i} className="row-in px-5 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap" style={{ animationDelay: `${i * 45}ms` }}>
                  <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] shrink-0"><FaUserClock size={13} style={{ color: rColor }} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{c.name || c.phone || tr("Customer")}
                      {c.ltv ? <span className="text-g-muted font-normal"> · {money(Math.round(Number(c.ltv) * 100))} LTV</span> : null}</div>
                    <div className="text-[11px] text-g-muted truncate">{tr("gone for")} {c.days_since_visit}{tr("d")} · {tr("usually comes every")} {c.usual_cadence_days}{tr("d")} · {c.visits} {tr("visits")}</div>
                  </div>
                  <span className="shrink-0 text-[11px] font-black num px-2 py-0.5 rounded-full" style={{ color: rColor, background: `${rColor}1a` }}>{rk}% {tr("risk")}</span>
                  <div className="shrink-0">
                    {gone ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-g-green px-2.5 py-1.5"><FaCheck size={10} /> {tr("In Gui's queue ✓")}</span>
                    ) : (
                      <button onClick={() => !demo && doReengage(c)} disabled={demo} title={demo ? tr("Available when connected — sample data") : undefined}
                        className="rounded-full px-3 py-1.5 text-[11px] font-bold text-[#161512] transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap inline-flex items-center gap-1.5"
                        style={{ background: c.suggested_action === "call" ? "#FF8A33" : "#FF4FA3" }}>
                        {c.suggested_action === "call" ? <><FaPhoneVolume size={10} /> {tr("Gui calls")}</> : <><FaCommentSms size={10} /> {tr("Gui texts")}</>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Top clientes */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#FF8A33" }}>{tr("Most valuable customers")}</span>
          <span className="text-[11px] text-g-muted hidden sm:inline">{tr("by LTV")}</span>
        </div>
        {L.ltv.estado !== "ok" ? (
          <Aviso lt={L.ltv} titulo={tr("I couldn't load your customer values.")} />
        ) : (ltv?.top || []).length === 0 ? (
          <Empty icon="🌿" text={tr("No LTV recorded yet — every visit and every payment add up here.")} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {(ltv.top).filter(Boolean).map((c, i) => (
              <div key={i} className="row-in px-5 py-3 flex items-center gap-3" style={{ animationDelay: `${i * 40}ms` }}>
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-black shrink-0" style={{ color: lifeColor(c.lifecycle) }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-g-word truncate">{c.name || tr("Customer")}</div>
                  <div className="text-[11px] text-g-muted truncate">{c.visit_count || 0} {tr("visits")}{c.lifecycle ? ` · ${tr(c.lifecycle)}` : ""}</div>
                </div>
                <span className="text-sm font-black num shrink-0" style={{ color: "#FF8A33" }}>{money(c.ltv_cents)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Origem dos clientes (atribuição) */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10">
          <span className="text-xs font-bold uppercase tracking-wide text-info-blue" style={{ color: "#4C9AFF" }}>{tr("Where customers come from")}</span>
        </div>
        {L.sources.estado !== "ok" ? (
          <Aviso lt={L.sources} titulo={tr("I couldn't load where your customers come from.")} />
        ) : sources.length === 0 ? (
          <Empty icon="🧭" text={tr("No source recorded yet — every new contact marks where it came from.")} />
        ) : (
          <div className="p-4 space-y-2.5">
            {(() => { const max = Math.max(1, ...sources.map((s) => Number(s.total) || 0)); return sources.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-[12px] font-bold text-g-word truncate">{s.source}</div>
                <div className="flex-1 h-6 rounded-full bg-white/[0.04] overflow-hidden relative">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((Number(s.total) || 0) / max * 100)}%`, background: "linear-gradient(90deg,#4C9AFF55,#4C9AFFcc)" }} />
                </div>
                <div className="w-10 shrink-0 text-right text-[12px] font-black num text-g-word">{s.total}</div>
                <div className="w-16 shrink-0 text-right text-[11px] font-bold num" style={{ color: (s.conv_pct || 0) >= 40 ? "#3E9468" : "#9A8F82" }}>{s.conv_pct || 0}% {tr("conv.")}</div>
              </div>
            )); })()}
          </div>
        )}
      </Card>

      {/* Previsão 7 dias */}
      {forecast && L.forecast.estado === "ok" && (
        <Card>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-g-green mb-2"><FaArrowTrendUp size={11} /> {tr("Forecast · next 7 days")}</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-2xl font-black num text-g-word">{forecast.expected_bookings_7d}</div><div className="text-[11px] text-g-muted">{tr("bookings")}</div></div>
            <div><div className="text-2xl font-black num" style={{ color: "#3E9468" }}>{money(forecast.expected_revenue_7d_cents)}</div><div className="text-[11px] text-g-muted">{tr("expected revenue")}</div></div>
            <div><div className="text-2xl font-black num text-g-word">{forecast.already_booked_7d}</div><div className="text-[11px] text-g-muted">{tr("already booked")}</div></div>
          </div>
          <p className="mt-3 text-[11px] text-g-muted">{tr("Base: average of the last 4 weeks. Simple and honest — it rises as Gui brings in more people.")}</p>
        </Card>
      )}

      {/* Agendamentos abandonados — 1-clique Gui chama de volta */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#FFC23D" }}>{tr("Abandoned bookings")}</span>
          <span className="text-[11px] text-g-muted hidden sm:inline">{tr("almost booked — 1 tap and Gui calls")}</span>
        </div>
        {L.abandoned.estado !== "ok" ? (
          <Aviso lt={L.abandoned} titulo={tr("I couldn't load your abandoned bookings.")} />
        ) : abandoned.length === 0 ? (
          <Empty icon="🌿" text={tr("No one left a booking half-done — everything's on track.")} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {abandoned.map((r, i) => {
              const gone = r.claimed || recovered[r.id];
              return (
                <div key={r.id || i} className="row-in px-5 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap" style={{ animationDelay: `${i * 45}ms` }}>
                  <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-base shrink-0">🛒</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{r.name || r.contact || tr("Customer")}{r.service ? <span className="text-g-muted font-normal"> · {r.service}</span> : null}</div>
                    <div className="text-[11px] text-g-muted truncate">{r.contact && r.name ? `${r.contact} · ` : ""}{tr("ago")} {r.minutes_ago}min{r.source ? ` · ${r.source}` : ""}</div>
                  </div>
                  <div className="shrink-0">
                    {gone ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-g-green px-2.5 py-1.5"><FaCheck size={10} /> {tr("In Gui's queue ✓")}</span>
                    ) : (
                      <button onClick={() => !demo && doRecover(r)} disabled={demo} title={demo ? tr("Available when connected — sample data") : undefined}
                        className="rounded-full px-3 py-1.5 text-[11px] font-bold text-[#161512] transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap inline-flex items-center gap-1.5"
                        style={{ background: "#FF8A33" }}>
                        <FaPhoneVolume size={10} /> {tr("Gui calls back")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

export default GrowthIntel;
