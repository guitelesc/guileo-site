/* Minha Empresa — COMPANY OS in the CLIENT cockpit.
   The client's OWN 8 departments (Finanças · Clientes · Vendas · Marketing ·
   Operações · Crescimento · Suporte · Inteligência) in one live overview.
   Backend: POST /api/my-company-os { email, token } → { ok, departments:[
     {key,label,icon,accent,kpi_value,kpi_label,ready}] } — per-tenant gated
   (get_client_data validates email↔key). ready:false → "aguardando dados".
   Demo mode = deterministic sample per sector; real mode = live fetch + skeleton. */
import { useState, useEffect } from "react";
import { tr, Card, Empty, SectionSkeleton, UI_LANG, vnum } from "../pages/Portal.jsx";

const LOCALE = () => (UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US");
const money = (cents) => {
  const v = (Number(cents) || 0) / 100;
  try { return new Intl.NumberFormat(LOCALE(), { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }
  catch { return `$${Math.round(v)}`; }
};

// ── POST helper (kept local — no shared file edits) ──
async function post(body) {
  try {
    const r = await fetch("/api/my-company-os", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

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
  return [
    { key: "finance",      label: tr("Finanças"),      icon: "💳", accent: "#3E9468", kpi_value: money(rev),        kpi_label: tr("receita coletada (30d)"), ready: true },
    { key: "crm",          label: tr("Clientes"),      icon: "👥", accent: "#FF8A33", kpi_value: `${contacts}`,      kpi_label: `${tr("contatos")} · ${money(ltv)} LTV`, ready: true },
    { key: "sales",        label: tr("Vendas"),        icon: "🎯", accent: "#FF4FA3", kpi_value: `${deals}`,         kpi_label: tr("fechamentos (30d)"),     ready: true },
    { key: "marketing",    label: tr("Marketing"),     icon: "📣", accent: "#4C9AFF", kpi_value: `${camp}`,          kpi_label: tr("campanhas ativas"),      ready: true },
    { key: "operations",   label: tr("Operações"),     icon: "⚙️", accent: "#9A8F82", kpi_value: `${ops}`,           kpi_label: tr("agendamentos (30d)"),    ready: true },
    { key: "growth",       label: tr("Crescimento"),   icon: "📈", accent: "#3E9468", kpi_value: `+${growth}%`,      kpi_label: tr("clientes recorrentes"),  ready: true },
    { key: "support",      label: tr("Suporte"),       icon: "🛟", accent: "#FFC23D", kpi_value: `${tickets}`,       kpi_label: tr("chamados abertos"),      ready: tickets > 0 },
    { key: "intelligence", label: tr("Inteligência"),  icon: "🧠", accent: "#FF8A33", kpi_value: `${actions}`,       kpi_label: tr("ações da Gui (30d)"),    ready: true },
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
            <span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{tr("ao vivo")}
          </span>
        ) : (
          <span className="text-[9px] font-black uppercase tracking-wider text-g-muted border border-white/10 rounded-full px-1.5 py-px">{tr("aguardando")}</span>
        )}
      </div>
      <div className="text-[10px] font-black uppercase tracking-wider text-g-muted">{d.label}</div>
      {ready ? (
        <>
          <div className="text-2xl font-black num leading-none" style={{ color: d.accent }}>{d.kpi_value}</div>
          <div className="text-[11px] text-g-muted">{d.kpi_label}</div>
        </>
      ) : (
        <div className="text-[12px] text-g-muted mt-1">{tr("aguardando dados")}</div>
      )}
    </div>
  );
}

function MyCompanyOS({ V, real = null, email = "", dataKey = "" }) {
  const [data, setData] = useState(null); // null = loading (real mode)
  const demo = !real;

  useEffect(() => {
    let alive = true;
    if (!real || !email || !dataKey) return;
    (async () => {
      const res = await post({ email, token: dataKey });
      if (!alive) return;
      setData({ departments: Array.isArray(res?.departments) ? res.departments : [] });
    })();
    return () => { alive = false; };
  }, [real, email, dataKey]);

  // real mode, fetch in flight → skeleton (never a false empty state)
  if (real && data === null) return <SectionSkeleton rows={6} />;

  const depts = demo ? genDemo(V) : (data?.departments || []);

  return (
    <div className="space-y-4 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          🏢 {tr("Minha Empresa")}
          {real
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("Os 8 departamentos do seu negócio, num lugar só, ao vivo.")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("A Gui opera cada departamento pra você — aqui você vê o pulso de todos de uma vez.")}</p>
      </div>

      {demo && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Sample data — connect your account to see your real growth intelligence.")}
        </div>
      )}

      {real && depts.length === 0 ? (
        <Card><Empty icon="🏢" text={tr("A inteligência está aquecendo — liga assim que seus clientes e agendamentos entram.")} /></Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {depts.map((d, i) => <DeptCard key={d.key || i} d={d} i={i} demo={demo} />)}
        </div>
      )}
    </div>
  );
}

export default MyCompanyOS;
