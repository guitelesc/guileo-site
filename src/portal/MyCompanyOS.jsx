/* Minha Empresa — COMPANY OS in the CLIENT cockpit.
   The client's OWN 8 departments (Finanças · Clientes · Vendas · Marketing ·
   Operações · Crescimento · Suporte · Inteligência) in one live overview.
   Backend: POST /api/my-company-os { email, token } → { ok, departments:[
     {key,label,icon,accent,kpi_value,kpi_label,ready}] } — per-tenant gated
   (get_client_data validates email↔key). ready:false → "aguardando dados".
   Demo mode = deterministic sample per sector; real mode = live fetch + skeleton. */
import { useState, useEffect } from "react";
import { tr, Card, Empty, SectionSkeleton, UI_LANG, vnum } from "../pages/Portal.jsx";
import { chamarApi } from "../lib/portalApi.js";
import FalhaDeLeitura from "./FalhaDeLeitura.jsx";

const LOCALE = () => (UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US");
const money = (cents) => {
  const v = (Number(cents) || 0) / 100;
  try { return new Intl.NumberFormat(LOCALE(), { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }
  catch { return `$${Math.round(v)}`; }
};

// 🌐 (2026-09-28) Rótulos por CHAVE de departamento, no idioma da tela. Esta tela tinha 17 chaves
// de tr() escritas em português ("Finanças", "aguardando dados"…): só a tela em português lia
// certo. E os rótulos que vinham do servidor chegavam em português para todo mundo.
// O servidor agora aceita `lang` e devolve o idioma em que respondeu; se ele NÃO confirmar o
// idioma da tela, os rótulos daqui valem — a cliente nunca lê o idioma errado por causa de deploy.
const rotuloDe = (key) => ({
  finance: tr("Finance"), crm: tr("Customers"), sales: tr("Sales"), marketing: tr("Marketing"),
  operations: tr("Operations"), growth: tr("Growth"), support: tr("Support"), intelligence: tr("Intelligence"),
}[key] || "");
const kpiDe = (key) => ({
  finance: tr("revenue collected (30d)"), crm: tr("contacts"), sales: tr("deals closed (30d)"),
  marketing: tr("active campaigns"), operations: tr("bookings (30d)"), growth: tr("returning customers"),
  support: tr("open tickets"), intelligence: tr("Gui actions (30d)"),
}[key] || "");

// ── deterministic demo departments (same per-sector flavor as the other tabs) ──
function genDemo(V) {
  const rev = vnum(V.label, "mco-rev", 4, 22) * 100000;   // cents
  const contacts = vnum(V.label, "mco-ct", 40, 320);
  const ltv = vnum(V.label, "mco-ltv", 180, 640) * 100;   // cents
  const deals = vnum(V.label, "mco-dl", 3, 18);
  const camp = vnum(V.label, "mco-cp", 1, 6);
  const ops = vnum(V.label, "mco-op", 8, 48);
  const growth = vnum(V.label, "mco-gr", 5, 30);
  const tickets = vnum(V.label, "mco-tk", 0, 7);
  const actions = vnum(V.label, "mco-ai", 6, 40);
  const d = (key, icon, accent, kpi_value, ready = true, kpi_label = kpiDe(key)) => ({ key, label: rotuloDe(key), icon, accent, kpi_value, kpi_label, ready });
  return [
    d("finance", "💳", "#3E9468", money(rev)),
    d("crm", "👥", "#FF8A33", `${contacts}`, true, `${tr("contacts")} · ${money(ltv)} LTV`),
    d("sales", "🎯", "#FF4FA3", `${deals}`),
    d("marketing", "📣", "#4C9AFF", `${camp}`),
    d("operations", "⚙️", "#9A8F82", `${ops}`),
    d("growth", "📈", "#3E9468", `+${growth}%`),
    d("support", "🛟", "#FFC23D", `${tickets}`, tickets > 0),
    d("intelligence", "🧠", "#FF8A33", `${actions}`),
  ];
}

function DeptCard({ d, i, demo }) {
  const ready = d.ready !== false;
  return (
    <div
      className="row-in rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-2 transition hover:bg-white/[0.04]"
      style={{ animationDelay: `${i * 40}ms`, opacity: ready ? 1 : 0.55 }}
    >
      <div className="flex items-center justify-between">
        <span className="grid place-items-center h-9 w-9 rounded-xl text-lg shrink-0" style={{ background: `${d.accent}1a` }}>{d.icon}</span>
        {ready ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-g-green">
            <span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{tr("live")}
          </span>
        ) : (
          <span className="text-[9px] font-black uppercase tracking-wider text-g-muted border border-white/10 rounded-full px-1.5 py-px">{tr("waiting")}</span>
        )}
      </div>
      <div className="text-[10px] font-black uppercase tracking-wider text-g-muted">{d.label}</div>
      {ready ? (
        <>
          <div className="text-2xl font-black num leading-none" style={{ color: d.accent }}>{d.kpi_value}</div>
          <div className="text-[11px] text-g-muted">{d.kpi_label}</div>
        </>
      ) : (
        <div className="text-[12px] text-g-muted mt-1">{tr("waiting for data")}</div>
      )}
    </div>
  );
}

function MyCompanyOS({ V, real = null, email = "", dataKey = "" }) {
  const [data, setData] = useState(null); // null = loading (real mode)
  const [falha, setFalha] = useState(null);
  const [tentativa, setTentativa] = useState(0);
  const demo = !real;

  useEffect(() => {
    let alive = true;
    if (!real) return;
    // 🚨 (2026-09-28) Dois defeitos. (1) Conta real sem e-mail/chave: o efeito saía sem fazer
    // nada e `data` ficava null = esqueleto para sempre. (2) Falha de leitura virava
    // `departments: []` e a tela dizia "a inteligência está aquecendo" — o estado de quem acabou
    // de chegar, mostrado a quem tem meses de dado e uma rede que piscou.
    if (!email || !dataKey) { setFalha("sem_credencial"); setData({ departments: [] }); return; }
    setData(null); setFalha(null);
    (async () => {
      const r = await chamarApi("/api/my-company-os", { email, token: dataKey, lang: UI_LANG });
      if (!alive) return;
      if (r.motivo) { setFalha(r.motivo); setData({ departments: [] }); return; }
      if (r.data.ok === false) { setFalha("servidor"); setData({ departments: [] }); return; }
      if (!Array.isArray(r.data.departments)) { setFalha("resposta_estranha"); setData({ departments: [] }); return; }
      // O servidor confirmou o idioma? Então os rótulos dele valem (inclusive o de departamento
      // novo, que esta tela ainda não conhece). Senão, valem os daqui.
      const noIdioma = r.data.lang === UI_LANG;
      setData({ departments: r.data.departments.filter(Boolean).map((d) => ({
        ...d,
        label: (noIdioma && d.label) || rotuloDe(d.key) || d.label || "",
        kpi_label: (noIdioma && d.kpi_label) || kpiDe(d.key) || "",
      })) });
    })();
    return () => { alive = false; };
  }, [real, email, dataKey, tentativa]);

  // real mode, fetch in flight → skeleton (never a false empty state)
  if (real && data === null) return <SectionSkeleton rows={6} />;

  const depts = demo ? genDemo(V) : (data?.departments || []);

  return (
    <div className="space-y-4 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          🏢 {tr("My Company")}
          {real
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("Your business's 8 departments, in one place, live.")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Gui runs each department for you — here you see the pulse of all of them at once.")}</p>
      </div>

      {demo && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Sample data — connect your account to see your real growth intelligence.")}
        </div>
      )}

      {real && falha ? (
        <FalhaDeLeitura motivo={falha} onRetry={() => setTentativa((n) => n + 1)} titulo={tr("I couldn't load your departments just now.")} />
      ) : real && depts.length === 0 ? (
        <Card><Empty icon="🏢" text={tr("Your intelligence is warming up — it switches on as soon as your customers and bookings come in.")} /></Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {depts.map((d, i) => <DeptCard key={d.key || i} d={d} i={i} demo={demo} />)}
        </div>
      )}
    </div>
  );
}

export default MyCompanyOS;
