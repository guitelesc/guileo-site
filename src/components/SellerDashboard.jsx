import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";

// 📊 SellerDashboard — the seller's PANEL. Big signal-dotted KPI tiles (clients / attributed
// leads / conversions + $ paid / AI pitches / estimated commission), a monthly-goal progress bar
// (target persisted in localStorage per seller), and the ANONYMIZED team 🏆 leaderboard with the
// rep's own row highlighted. Data: POST /api/seller-dashboard (seller-gated). Reads everything
// defensively — the panel degrades to motivational empty states, never a crash.
// Signal palette (LOCKED): Gui orange #FF8A33 · green #3E9468 · blue #5B9BD5 · amber #f2b23e.

const D = {
  pt: {
    title: "📊 Painel", sub: "Seus números, ao vivo. Cada cliente que você assina e cada lead do seu link aparecem aqui na hora.",
    refresh: "↻ Atualizar", loading: "Carregando seu painel…",
    clients: "Clientes", clientsLive: "no ar", leads30: "Leads (30 dias)", converted: "Convertidos",
    paid: "pago pelos clientes", pitches: "Pitches c/ IA", commission: "Comissão estimada",
    commissionNote: "{pct}% sobre os pagamentos registrados dos seus clientes. Vira dinheiro real quando eles pagam.",
    goalTitle: "🎯 Meta do mês", goalSub: "Defina quantos clientes quer fechar este mês — a barra enche sozinha conforme eles pagam.",
    goalOf: "de", goalDeals: "clientes fechados", goalSet: "Meta", goalDone: "Meta batida! 🎉",
    rankTitle: "🏆 Ranking do time", rankSub: "Onde você está entre os vendedores. Só primeiro nome — os números de cada um ficam privados.",
    rankYou: "Você", rankClients: "clientes", rankEmpty: "O ranking acende quando o time começa a fechar. Seja o primeiro no pódio.",
    emptyClients: "Seu primeiro cliente começa na aba 🎯 Alvos.",
    emptyLeads: "Compartilhe seu link de indicação (aba Minhas Metas) e os leads aparecem aqui.",
    err: "Não consegui carregar agora — tenta atualizar.",
    ctaClients: "Ver carteira", ctaLeads: "Buscar alvos", ctaConverted: "Fechar",
    ctaPitches: "Ver pitches", ctaCommission: "Minhas metas", goalMore: "🎯 Buscar mais alvos",
  },
  en: {
    title: "📊 Panel", sub: "Your numbers, live. Every client you sign and every lead from your link shows up here instantly.",
    refresh: "↻ Refresh", loading: "Loading your panel…",
    clients: "Clients", clientsLive: "live", leads30: "Leads (30 days)", converted: "Converted",
    paid: "paid by clients", pitches: "AI pitches", commission: "Estimated commission",
    commissionNote: "{pct}% of your clients' registered payments. Becomes real money when they pay.",
    goalTitle: "🎯 Monthly goal", goalSub: "Set how many clients you want to close this month — the bar fills itself as they pay.",
    goalOf: "of", goalDeals: "clients closed", goalSet: "Goal", goalDone: "Goal hit! 🎉",
    rankTitle: "🏆 Team ranking", rankSub: "Where you stand among the sellers. First name only — everyone's numbers stay private.",
    rankYou: "You", rankClients: "clients", rankEmpty: "The ranking lights up once the team starts closing. Be first on the podium.",
    emptyClients: "Your first client starts in the 🎯 Targets tab.",
    emptyLeads: "Share your referral link (My Goals tab) and leads show up here.",
    err: "Couldn't load right now — try refreshing.",
    ctaClients: "View book", ctaLeads: "Find targets", ctaConverted: "Close",
    ctaPitches: "View pitches", ctaCommission: "My goals", goalMore: "🎯 Find more targets",
  },
  es: {
    title: "📊 Panel", sub: "Tus números, en vivo. Cada cliente que firmas y cada lead de tu enlace aparecen aquí al instante.",
    refresh: "↻ Actualizar", loading: "Cargando tu panel…",
    clients: "Clientes", clientsLive: "en vivo", leads30: "Leads (30 días)", converted: "Convertidos",
    paid: "pagado por clientes", pitches: "Pitches con IA", commission: "Comisión estimada",
    commissionNote: "{pct}% de los pagos registrados de tus clientes. Se vuelve dinero real cuando pagan.",
    goalTitle: "🎯 Meta del mes", goalSub: "Define cuántos clientes quieres cerrar este mes — la barra se llena sola cuando pagan.",
    goalOf: "de", goalDeals: "clientes cerrados", goalSet: "Meta", goalDone: "¡Meta lograda! 🎉",
    rankTitle: "🏆 Ranking del equipo", rankSub: "Dónde estás entre los vendedores. Solo primer nombre — los números de cada uno quedan privados.",
    rankYou: "Tú", rankClients: "clientes", rankEmpty: "El ranking se enciende cuando el equipo empieza a cerrar. Sé el primero en el podio.",
    emptyClients: "Tu primer cliente empieza en la pestaña 🎯 Objetivos.",
    emptyLeads: "Comparte tu enlace de referido (pestaña Mis Metas) y los leads aparecen aquí.",
    err: "No pude cargar ahora — intenta actualizar.",
    ctaClients: "Ver cartera", ctaLeads: "Buscar objetivos", ctaConverted: "Cerrar",
    ctaPitches: "Ver pitches", ctaCommission: "Mis metas", goalMore: "🎯 Buscar más objetivos",
  },
};
D.hi = { ...D.en, title: "📊 पैनल", rankYou: "आप", goalDone: "लक्ष्य पूरा! 🎉" };

const GOAL_KEY = (email) => `guileo_seller_goal:${(email || "").toString().trim().toLowerCase()}`;
function loadGoal(email) {
  try { return Math.max(0, parseInt(localStorage.getItem(GOAL_KEY(email)), 10) || 0); } catch { return 0; }
}
const money = (n) => `$${(Number(n) || 0).toLocaleString("en-US")}`;

// Big KPI tile with a colored signal dot (matches the LOCKED signal palette).
// When `onClick` is provided (nav wired) the tile becomes an accessible button that
// jumps to the matching action tab; without it, it stays a static card (backward-compat).
function Kpi({ dot, icon, value, label, sub, valueColor, onClick, cta }) {
  const clickable = typeof onClick === "function";
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: dot, boxShadow: `0 0 10px ${dot}66` }} />
        <span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{icon} {label}</span>
      </div>
      <div className="mt-2 text-[26px] font-black leading-none" style={{ color: valueColor || "var(--g-word, #f4f1ea)" }}>{value}</div>
      {sub != null && <div className="mt-1 text-[11.5px] text-g-muted">{sub}</div>}
      {clickable && cta && <div className="mt-2 text-[11px] font-bold text-g-muted opacity-70 transition-opacity group-hover:opacity-100">{cta} →</div>}
    </>
  );
  if (!clickable) return <div className="card p-4">{inner}</div>;
  return (
    <button type="button" onClick={onClick} aria-label={cta || `${label} — ${value}`}
      className="group card p-4 cursor-pointer text-left transition-colors hover:border-white/20 hover:bg-white/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25">
      {inner}
    </button>
  );
}

function Podium({ rows, d }) {
  // top-3 podium: order visually 2 · 1 · 3 with medals
  const top = rows.slice(0, 3);
  const order = top.length === 3 ? [top[1], top[0], top[2]] : top;
  const medalFor = (row) => (row === top[0] ? "🥇" : row === top[1] ? "🥈" : "🥉");
  const heights = (row) => (row === top[0] ? "h-20" : row === top[1] ? "h-14" : "h-11");
  return (
    <div className="flex items-end justify-center gap-3">
      {order.map((row, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
          className="flex w-1/3 max-w-[130px] flex-col items-center">
          <div className="text-2xl">{medalFor(row)}</div>
          <div className={`mt-1 truncate max-w-full text-[12.5px] font-extrabold ${row.me ? "text-g-green" : "text-g-word"}`}>{row.name}{row.me ? ` · ${d.rankYou}` : ""}</div>
          <div className="text-[11px] font-bold text-g-muted">{money(row.paid)}</div>
          <div className={`mt-1.5 w-full rounded-t-lg ${heights(row)} ${row.me ? "bg-g-green/30 ring-1 ring-g-green/50" : "bg-white/[0.07] ring-1 ring-white/10"}`} />
        </motion.div>
      ))}
    </div>
  );
}

export default function SellerDashboard({ lang = "pt", seller, market = "us", nav, handoff }) {
  const d = D[lang] || D.pt;
  // Payments are stored in USD. We show them in USD ALWAYS — slapping a R$ symbol on a USD number
  // would misprice the seller's earnings ~5×. Honesty first: one currency, the real one. (market
  // prop is still accepted for signature parity but never fakes a conversion here.)
  void market;
  const moneyM = (n) => money(n);
  const convNote = "";
  // nav() is optional — when the orchestrator wires it, tiles become buttons; go() no-ops otherwise.
  const go = typeof nav === "function" ? (tab, payload) => nav(tab, payload) : null;
  // handoff is consumed on mount by design (parent remounts via key={tab}); this panel has no
  // inbound payload shape today, so we read it once defensively and keep it inert (future-proof).
  useState(() => handoff || null);
  const [data, setData] = useState(null);   // null = loading · {} = loaded
  const [err, setErr] = useState(false);
  const [goal, setGoal] = useState(() => loadGoal(seller?.email));

  const load = async () => {
    setErr(false);
    try {
      const r = await fetch("/api/seller-dashboard", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seller_email: seller.email, seller_code: seller.code || "", ref: seller.ref || "", seller: { name: seller.name, email: seller.email, ref: seller.ref } }),
      });
      const j = await r.json().catch(() => ({}));
      if (j && j.ok) setData(j);
      else { setData({ dashboard: {}, leaderboard: [] }); setErr(true); }
    } catch { setData({ dashboard: {}, leaderboard: [] }); setErr(true); }
  };
  useEffect(() => {
    if (!seller?.email) return;
    load();
    const iv = setInterval(load, 30000);           // live — mirrors the wallet's self-refresh
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(iv); window.removeEventListener("focus", onFocus); };
  }, [seller?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveGoal = (v) => {
    const n = Math.max(0, parseInt(v, 10) || 0);
    setGoal(n);
    try { localStorage.setItem(GOAL_KEY(seller?.email), String(n)); } catch { /* private mode */ }
  };

  const db = data?.dashboard || {};
  const board = Array.isArray(data?.leaderboard) ? data.leaderboard : [];
  const clients = db.clients || { total: 0, live: 0, draft: 0 };
  const pct = Number(db.commission_pct) || 10;
  const converted = Number(db.converted) || 0;
  // the MONTHLY goal bar must read the month-scoped count (all-time would never reset) —
  // falls back to all-time only while db/seller_metrics.sql hasn't been re-applied.
  const convertedMonth = db.converted_month != null ? Number(db.converted_month) || 0 : converted;
  const goalPct = goal > 0 ? Math.min(100, Math.round((convertedMonth / goal) * 100)) : 0;
  const rest = useMemo(() => board.slice(3), [board]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-xl font-black text-g-word">{d.title}</h2><p className="text-[13px] text-g-muted mt-1 max-w-2xl">{d.sub}</p></div>
        <button type="button" onClick={load} className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-[11.5px] font-bold text-g-muted hover:text-g-word">{d.refresh}</button>
      </div>

      {data === null && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />)}
        </div>
      )}
      {data !== null && err && <div className="text-[12.5px] text-g-gold">{d.err}</div>}

      {data !== null && (
        <>
          {/* KPI tiles — signal dots: green clients · orange leads · blue converted · amber pitches · green $
              Each tile routes to its action tab when nav is wired (go): clients→followup, leads→alvos,
              converted/$→fechar, pitches→cards, commission→metas. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi dot="#3E9468" icon="🤝" value={clients.total} label={d.clients} sub={`${clients.live} ${d.clientsLive}`}
              onClick={go && (() => go("followup"))} cta={d.ctaClients} />
            <Kpi dot="#FF8A33" icon="🎯" value={db.leads_30d || 0} label={d.leads30}
              sub={(db.leads_30d || 0) === 0 ? d.emptyLeads : null} valueColor="#FF8A33"
              onClick={go && (() => go("alvos"))} cta={d.ctaLeads} />
            <Kpi dot="#5B9BD5" icon="💰" value={converted} label={d.converted} sub={moneyM(db.paid) + convNote} valueColor="#5B9BD5"
              onClick={go && (() => go("fechar"))} cta={d.ctaConverted} />
            <Kpi dot="#f2b23e" icon="📣" value={db.pitches || 0} label={d.pitches}
              onClick={go && (() => go("cards"))} cta={d.ctaPitches} />
            <Kpi dot="#3E9468" icon="💵" value={moneyM(db.commission_est) + convNote} label={d.commission} valueColor="#3E9468"
              onClick={go && (() => go("metas"))} cta={d.ctaCommission} />
          </div>
          <p className="text-[11.5px] text-g-muted">{d.commissionNote.replace("{pct}", pct)}</p>

          {/* Monthly goal — local target, progress = real conversions */}
          <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.05] p-5">
            <div className="text-sm font-extrabold text-g-green">{d.goalTitle}</div>
            <p className="text-[12.5px] text-g-muted mt-1 max-w-2xl">{d.goalSub}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="text-[13px] text-g-word">
                <span className="text-2xl font-black text-g-green">{convertedMonth}</span>
                <span className="text-g-muted"> {d.goalOf} </span>
                <input type="number" min="0" value={goal} onChange={(e) => saveGoal(e.target.value)} aria-label={d.goalSet}
                  className="w-16 rounded border border-white/15 bg-white/[0.06] px-2 py-1 text-center text-[14px] font-bold text-g-word focus:outline-none focus:border-g-green/50" />
                <span className="text-g-muted"> {d.goalDeals}</span>
              </div>
              {goal > 0 && goalPct >= 100 && <span className="rounded-full bg-g-green/15 px-3 py-1 text-[11.5px] font-black text-g-green ring-1 ring-g-green/30">{d.goalDone}</span>}
              {/* goal hit → keep the momentum: jump straight to target-generation (only when nav is wired) */}
              {go && goal > 0 && goalPct >= 100 && (
                <button type="button" onClick={() => go("alvos")}
                  className="rounded-full border border-g-green/40 bg-g-green/10 px-3 py-1 text-[11.5px] font-black text-g-green transition-colors hover:bg-g-green/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-g-green/40">
                  {d.goalMore}
                </button>
              )}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full bg-gradient-to-r from-g-green to-g-light" initial={{ width: 0 }} animate={{ width: `${goalPct}%` }} transition={{ duration: 0.5 }} />
            </div>
          </div>

          {/* 🏆 Team ranking — anonymized, own row highlighted */}
          <div className="rounded-2xl border border-g-gold/25 bg-g-gold/[0.05] p-5">
            <div className="text-sm font-extrabold text-g-gold">{d.rankTitle}</div>
            <p className="text-[12.5px] text-g-muted mt-1 max-w-2xl">{d.rankSub}</p>
            {board.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                <div className="text-3xl">🏆</div>
                <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-g-muted">{d.rankEmpty}</p>
              </div>
            ) : (
              <>
                <div className="mt-4"><Podium rows={board} d={d} /></div>
                {rest.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    {rest.map((row, i) => (
                      <div key={i} className={`flex items-center gap-3 rounded-xl border px-4 py-2 text-[13px] ${row.me ? "border-g-green/40 bg-g-green/[0.08]" : "border-white/10 bg-white/[0.03]"}`}>
                        <span className="w-6 shrink-0 text-center font-black text-g-muted">{i + 4}</span>
                        <span className={`truncate font-bold ${row.me ? "text-g-green" : "text-g-word"}`}>{row.name}{row.me ? ` · ${d.rankYou}` : ""}</span>
                        <span className="ml-auto shrink-0 text-[12px] text-g-muted">{row.clients} {d.rankClients}</span>
                        <span className="shrink-0 font-bold text-g-word">{money(row.paid)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {clients.total === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
              <div className="text-3xl">🌱</div>
              <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-g-muted">{d.emptyClients}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
