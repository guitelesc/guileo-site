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
import { toast } from "../lib/portalApi.js";
import { tr, Card, Empty, SectionSkeleton, UI_LANG, vnum } from "../pages/Portal.jsx";

const LOCALE = () => (UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US");
const money = (cents) => {
  const v = (Number(cents) || 0) / 100;
  try { return new Intl.NumberFormat(LOCALE(), { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }
  catch { return `$${Math.round(v)}`; }
};

// ── shared POST helper (kept local — no shared file edits) ──
async function giPost(body) {
  try {
    const r = await fetch("/api/growth-intel", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

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
    { source: tr("Indicação"), total: vnum(V.label, "s2", 15, 50), conv_pct: 61 },
    { source: tr("direto"), total: vnum(V.label, "s3", 10, 40), conv_pct: 29 },
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
  const demo = !real;

  useEffect(() => {
    let alive = true;
    if (!real || !email || !dataKey) return;
    (async () => {
      const [ltvR, srcR, fcR, abR, chR] = await Promise.all([
        giPost({ action: "ltv", token: dataKey, email }),
        giPost({ action: "sources", token: dataKey, email }),
        giPost({ action: "forecast", token: dataKey, email }),
        giPost({ action: "abandoned", token: dataKey, email }),
        giPost({ action: "churn", token: dataKey, email }),
      ]);
      if (!alive) return;
      const ready = !!(ltvR?.ready || srcR?.ready || fcR?.ready || abR?.ready || chR?.ready);
      setData({
        ready,
        ltv: ltvR?.ltv || null,
        sources: Array.isArray(srcR?.sources) ? srcR.sources : [],
        forecast: fcR?.forecast || null,
        abandoned: Array.isArray(abR?.intents) ? abR.intents : [],
        atRisk: Array.isArray(chR?.atRisk) ? chR.atRisk : [],
      });
    })();
    return () => { alive = false; };
  }, [real, email, dataKey]);

  const doRecover = async (r) => {
    setRecovered((s) => ({ ...s, [r.id]: true }));                  // optimistic
    toast(tr("Gui vai chamar de volta — aparece no seu feed ✓"));
    const res = await giPost({ action: "recover", token: dataKey, email, intent_id: r.id, name: r.name || "", contact: r.contact || "" });
    if (!res || !res.ok || !res.claimed) {
      setRecovered((s) => { const n = { ...s }; delete n[r.id]; return n; });
      toast(tr("Não consegui salvar isso — confira a conexão e tente de novo."));
    }
  };

  const [reengaged, setReengaged] = useState({}); // phone → true (optimistic)
  const doReengage = async (c) => {
    const id = c.phone || c.contact_email || c.name;
    setReengaged((s) => ({ ...s, [id]: true }));
    toast(c.suggested_action === "call" ? tr("Gui vai ligar de volta — na fila ✓") : tr("Gui vai mandar SMS de volta — na fila ✓"));
    const res = await giPost({ action: "reengage", token: dataKey, email, name: c.name || "", contact: c.phone || c.contact_email || "", suggested: c.suggested_action || "sms", risk: c.risk });
    if (!res || !res.ok || !res.queued) {
      setReengaged((s) => { const n = { ...s }; delete n[id]; return n; });
      toast(tr("Não consegui salvar isso — confira a conexão e tente de novo."));
    }
  };

  // real mode, fetch in flight → skeleton (never a false empty state)
  if (real && data === null) return <SectionSkeleton rows={6} />;

  const D = demo ? genDemo(V) : data;
  const ltv = D.ltv, sources = D.sources || [], forecast = D.forecast, abandoned = D.abandoned || [], atRisk = D.atRisk || [];
  const notReady = real && data && !data.ready;

  return (
    <div className="space-y-4 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          <FaChartLine size={11} /> {tr("Inteligência de Crescimento")}
          {real
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("Quanto vale cada cliente, de onde eles vêm, e o que vem pela frente.")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Recorrência é a maior alavanca — recupere quem quase agendou e traga o cliente de volta.")}</p>
      </div>

      {demo && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Sample data — connect your account to see your real growth intelligence.")}
        </div>
      )}

      {notReady && (
        <Card><Empty icon="📡" text={tr("A inteligência está aquecendo — liga assim que seus clientes e agendamentos entram.")} /></Card>
      )}

      {/* LTV */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label={tr("LTV total")} value={money(ltv?.total_ltv_cents)} sub={`${ltv?.contact_count || 0} ${tr("clientes")}`} color="#FF8A33" icon={<FaUsers size={10} />} />
        <Metric label={tr("Ticket médio (LTV)")} value={money(ltv?.avg_ltv_cents)} sub={`${ltv?.paying_count || 0} ${tr("pagantes")}`} color="#FF8A33" icon={<FaChartLine size={10} />} />
        <Metric label={tr("Previsão 7 dias")} value={forecast ? `${forecast.expected_bookings_7d} ${tr("agend.")}` : "—"} sub={forecast ? money(forecast.expected_revenue_7d_cents) : ""} color="#3E9468" icon={<FaArrowTrendUp size={10} />} />
        <Metric label={tr("Abandonados")} value={`${abandoned.filter((a) => !a.claimed && !recovered[a.id]).length}`} sub={tr("para recuperar")} color="#FFC23D" icon={<FaCartArrowDown size={10} />} />
      </div>

      {/* Clientes prestes a sumir — churn radar, 1-clique Gui reativa */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: "#FF4FA3" }}><FaHeartCrack size={11} /> {tr("Clientes prestes a sumir")}</span>
          <span className="text-[11px] text-g-muted hidden sm:inline">{tr("sumiram além do costume — 1 toque e o Gui reativa")}</span>
        </div>
        {atRisk.length === 0 ? (
          <Empty icon="💚" text={tr("Ninguém em risco de sumir — sua base está voltando no ritmo dela.")} />
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
                    <div className="text-sm font-bold text-g-word truncate">{c.name || c.phone || tr("Cliente")}
                      {c.ltv ? <span className="text-g-muted font-normal"> · {money(Math.round(Number(c.ltv) * 100))} LTV</span> : null}</div>
                    <div className="text-[11px] text-g-muted truncate">{tr("sumido há")} {c.days_since_visit}{tr("d")} · {tr("costuma vir a cada")} {c.usual_cadence_days}{tr("d")} · {c.visits} {tr("visitas")}</div>
                  </div>
                  <span className="shrink-0 text-[11px] font-black num px-2 py-0.5 rounded-full" style={{ color: rColor, background: `${rColor}1a` }}>{rk}% {tr("risco")}</span>
                  <div className="shrink-0">
                    {gone ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-g-green px-2.5 py-1.5"><FaCheck size={10} /> {tr("Na fila do Gui ✓")}</span>
                    ) : (
                      <button onClick={() => !demo && doReengage(c)} disabled={demo} title={demo ? tr("Available when connected — sample data") : undefined}
                        className="rounded-full px-3 py-1.5 text-[11px] font-bold text-[#161512] transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap inline-flex items-center gap-1.5"
                        style={{ background: c.suggested_action === "call" ? "#FF8A33" : "#FF4FA3" }}>
                        {c.suggested_action === "call" ? <><FaPhoneVolume size={10} /> {tr("Gui liga")}</> : <><FaCommentSms size={10} /> {tr("Gui manda SMS")}</>}
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
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#FF8A33" }}>{tr("Clientes mais valiosos")}</span>
          <span className="text-[11px] text-g-muted hidden sm:inline">{tr("por LTV")}</span>
        </div>
        {(ltv?.top || []).length === 0 ? (
          <Empty icon="🌿" text={tr("Ainda sem LTV registrado — cada visita e cada pagamento vão somando aqui.")} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {(ltv.top).map((c, i) => (
              <div key={i} className="row-in px-5 py-3 flex items-center gap-3" style={{ animationDelay: `${i * 40}ms` }}>
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-black shrink-0" style={{ color: lifeColor(c.lifecycle) }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-g-word truncate">{c.name || tr("Cliente")}</div>
                  <div className="text-[11px] text-g-muted truncate">{c.visit_count || 0} {tr("visitas")}{c.lifecycle ? ` · ${tr(c.lifecycle)}` : ""}</div>
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
          <span className="text-xs font-bold uppercase tracking-wide text-info-blue" style={{ color: "#4C9AFF" }}>{tr("De onde vêm os clientes")}</span>
        </div>
        {sources.length === 0 ? (
          <Empty icon="🧭" text={tr("Sem origem registrada ainda — cada novo contato marca de onde veio.")} />
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
      {forecast && (
        <Card>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-g-green mb-2"><FaArrowTrendUp size={11} /> {tr("Previsão · próximos 7 dias")}</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-2xl font-black num text-g-word">{forecast.expected_bookings_7d}</div><div className="text-[11px] text-g-muted">{tr("agendamentos")}</div></div>
            <div><div className="text-2xl font-black num" style={{ color: "#3E9468" }}>{money(forecast.expected_revenue_7d_cents)}</div><div className="text-[11px] text-g-muted">{tr("receita esperada")}</div></div>
            <div><div className="text-2xl font-black num text-g-word">{forecast.already_booked_7d}</div><div className="text-[11px] text-g-muted">{tr("já agendados")}</div></div>
          </div>
          <p className="mt-3 text-[11px] text-g-muted">{tr("Base: média das últimas 4 semanas. Simples e honesto — sobe conforme o Gui traz mais gente.")}</p>
        </Card>
      )}

      {/* Agendamentos abandonados — 1-clique Gui chama de volta */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#FFC23D" }}>{tr("Agendamentos abandonados")}</span>
          <span className="text-[11px] text-g-muted hidden sm:inline">{tr("quase agendaram — 1 toque e o Gui chama")}</span>
        </div>
        {abandoned.length === 0 ? (
          <Empty icon="🌿" text={tr("Ninguém deixou um agendamento pela metade — tudo em dia.")} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {abandoned.map((r, i) => {
              const gone = r.claimed || recovered[r.id];
              return (
                <div key={r.id || i} className="row-in px-5 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap" style={{ animationDelay: `${i * 45}ms` }}>
                  <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-base shrink-0">🛒</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{r.name || r.contact || tr("Cliente")}{r.service ? <span className="text-g-muted font-normal"> · {r.service}</span> : null}</div>
                    <div className="text-[11px] text-g-muted truncate">{r.contact && r.name ? `${r.contact} · ` : ""}{tr("há")} {r.minutes_ago}min{r.source ? ` · ${r.source}` : ""}</div>
                  </div>
                  <div className="shrink-0">
                    {gone ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-g-green px-2.5 py-1.5"><FaCheck size={10} /> {tr("Na fila do Gui ✓")}</span>
                    ) : (
                      <button onClick={() => !demo && doRecover(r)} disabled={demo} title={demo ? tr("Available when connected — sample data") : undefined}
                        className="rounded-full px-3 py-1.5 text-[11px] font-bold text-[#161512] transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap inline-flex items-center gap-1.5"
                        style={{ background: "#FF8A33" }}>
                        <FaPhoneVolume size={10} /> {tr("Gui chama de volta")}
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
