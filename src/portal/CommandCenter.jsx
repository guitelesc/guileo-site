/* Split out of Portal.jsx (performance): CommandCenter tab view. */
import { useState, useEffect, useCallback } from "react";
import { toast } from "../lib/portalApi.js";
import { genCustomers, tr, Card, MiniStats, Empty, UI_LANG } from "../pages/Portal.jsx";

const LOCALE = { pt: "pt-BR", es: "es-ES", hi: "hi-IN", en: "en-US" };

/* 🚨 FALHA NÃO É ZERO (2026-09-28). As quatro leituras desta tela vinham dos leitores de
   portalApi, que devolvem `[]` tanto para "não há" quanto para "não consegui ler". Um piscar de
   rede e a tela afirmava, sob o selo de dado real: "Revenue won $0 · Pipeline $0 · Contacts 0".
   Aqui a leitura é feita direto e devolve `null` quando FALHA — e `null` vira "—" na tela, com o
   aviso e o botão de tentar de novo. Zero só aparece quando o servidor disse zero. */
async function ler(url, corpo) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d || typeof d !== "object" || d.ok === false || d.error || d.erro) return null;
    return d;
  } catch { return null; }
}

// Command Center — the Company-OS "brain": unifies the live spine into one screen — money
// (revenue won + open pipeline), the funnel (contacts/leads/churn) and the predictive no-show radar.
function CommandCenter({ V, onNav, real = null, email = "", dataKey = "" }) {
  const demo = !dataKey;
  // null = NÃO CONSEGUI LER · false = recurso ainda não ativado na conta (`ready:false`) ·
  // lista/objeto = lido. Os dois primeiros viram "—" na tela; só o primeiro acende o aviso de falha.
  const [contacts, setContacts] = useState(null);
  const [deals, setDeals] = useState(null);
  const [radar, setRadar] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [frios, setFrios] = useState(null);       // nº de clientes em risco — contado pelo SERVIDOR
  const [loaded, setLoaded] = useState(false);
  const [seq, setSeq] = useState(0);

  useEffect(() => {
    let alive = true;
    if (demo) {
      const sc = V.customers || genCustomers(V);
      const stages = ["inquiry", "quoted", "booked", "won"];
      const cs = sc.map((c, i) => ({ ltv_cents: Math.round((c.spent || 0) * 100), lifecycle: i === 0 ? "vip" : (c.orders || 1) > 1 ? "customer" : "lead", churn_risk: i % 4 === 3 ? 64 : 11 }));
      setContacts(cs);
      setDeals(sc.map((c, i) => ({ value_cents: Math.round((c.spent || 0) * 100), stage: stages[i % 4], status: i % 4 === 3 ? "won" : "open" })));
      setRadar({ ready: true, highRisk: 1, appointments: sc.slice(0, 3).map((c, i) => ({ customer_name: c.name, starts_at: null, risk: [72, 38, 21][i] || 20, reason: i === 0 ? "2 prior no-show(s) · booked 9d ahead" : "booked 2d ahead" })) });
      setInvoices(sc.map((c, i) => ({ amount_cents: Math.round((c.spent || 50) * 100), status: ["paid", "sent", "overdue", "paid", "overdue"][i % 5] })));
      setFrios(cs.filter((c) => (c.churn_risk || 0) >= 50).length);
      setLoaded(true);
      return () => { alive = false; };
    }
    setLoaded(false);
    const base = { token: dataKey, email: email || "" };
    Promise.all([
      ler("/api/crm", base),
      ler("/api/crm", { ...base, action: "deals" }),
      ler("/api/noshow-radar", { ...base, days: 7 }),
      ler("/api/crm", { ...base, action: "invoices" }),
      // UMA fonte para "quem está esfriando": o radar do servidor (churn_risk_scan), o MESMO que a
      // tela de Retenção lista. Antes esta tela recontava no navegador com outra regra e dizia
      // "1 contacts going cold" enquanto o servidor respondia zero para a mesma conta.
      ler("/api/growth-intel", { ...base, action: "churn" }),
    ]).then(([c, d, r, i, ch]) => {
      if (!alive) return;
      const lido = (x, campo) => (!x ? null : x.ready === false ? false : Array.isArray(x[campo]) ? x[campo] : null);
      setContacts(lido(c, "contacts"));
      setDeals(lido(d, "deals"));
      const ap = lido(r, "appointments");
      setRadar(ap ? { ready: true, highRisk: Number(r.highRisk) || 0, appointments: ap } : ap);
      setInvoices(lido(i, "invoices"));
      const ar = lido(ch, "atRisk");
      setFrios(ar ? ar.length : ar);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [demo, dataKey, email, seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const money = (c) => `$${Math.round((c || 0) / 100).toLocaleString()}`;
  const ou = (v, f) => (v == null || v === false ? "—" : f(v));   // não lido / não ativado → "—": não medido não é zero
  const openVal = deals && deals.filter((d) => d.status === "open").reduce((s, d) => s + (d.value_cents || 0), 0);
  const ganhos = deals && deals.filter((d) => d.status === "won" || d.stage === "won");
  const wonVal = ganhos && ganhos.reduce((s, d) => s + (d.value_cents || 0), 0);
  const ltv = contacts && contacts.reduce((s, c) => s + (c.ltv_cents || 0), 0);
  const leads = contacts && contacts.filter((c) => (c.lifecycle || "lead") === "lead").length;
  const riskCls = (r) => r >= 60 ? "bg-red-500/15 text-red-300" : r >= 35 ? "bg-g-gold/15 text-g-gold" : "bg-g-green/15 text-g-green";
  const algumaFalha = !demo && loaded && [contacts, deals, radar, invoices, frios].some((x) => x === null);

  // ── NEXT BEST ACTIONS — the co-pilot strip: highest-value actions across departments ──
  const overdue = (invoices || []).filter((i) => i.status === "overdue");
  const overdueSum = overdue.reduce((s, i) => s + (i.amount_cents || 0), 0);
  const risky = ((radar && radar.appointments) || []).filter((a) => (a.risk || 0) >= 60).length;
  // Over-confirm — Gui actually reaches every high-risk booking (branded email now, phone queued for
  // the confirm engine). Only claims "reminded" on a true send count from the backend.
  const [confirmando, setConfirmando] = useState(false);
  const overConfirm = useCallback(async () => {
    if (!dataKey) { toast(tr("Connect your account to over-confirm for real.")); return; }
    if (confirmando) return;
    setConfirmando(true);
    try {
      const r = await fetch("/api/noshow-radar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: dataKey, email, action: "confirm" }) });
      const d = await r.json().catch(() => ({}));
      // "Queued ✓ — Gui will remind them" saía com 0 enviados: fila que ninguém provou que existe.
      // Sucesso só com número; zero é dito como zero.
      if (r.ok && d?.ok) toast((Number(d.sent) || 0) > 0 ? `${tr("Gui reminded")} ${d.sent} ${tr("customers")} ✓` : tr("No reminder was sent — nobody on the list could be reached right now."));
      else toast(tr("Couldn't reach the confirmation engine — try again."));
    } catch { toast(tr("Couldn't reach the confirmation engine — try again.")); }
    setConfirmando(false);
  }, [dataKey, email, confirmando]);
  const nba = [];
  if (overdue.length) nba.push({ icon: "🏦", label: `${overdue.length} ${tr(overdue.length === 1 ? "overdue invoice" : "overdue invoices")} (${money(overdueSum)})`, cta: tr("Review & collect"), act: () => onNav?.("finance") });
  // 🚨 "Reactivate" disparava /api/reactivate com UM clique e sem prévia — e o motor nem existia
  // (o toast culpava a conexão). O botão agora LEVA à tela de Retenção, onde a reativação mostra
  // quantas pessoas e por qual canal ANTES de enviar, e diz "ainda não disponível" quando é o caso.
  if (frios) nba.push({ icon: "🔄", label: `${frios} ${tr(frios === 1 ? "customer going cold" : "customers going cold")}`, cta: tr("Review →"), act: () => onNav?.("retention") });
  if (risky) nba.push({ icon: "🔮", label: `${risky} ${tr(risky === 1 ? "high-risk no-show" : "high-risk no-shows")}`, cta: confirmando ? tr("Sending…") : tr("Over-confirm"), act: overConfirm });

  // 🚨 "This week Gui kept 5 contacts moving…" — nada aqui é filtrado por semana: são TODOS os
  // contatos e TODOS os negócios ganhos da conta. A frase agora descreve o que o número é: o
  // estado de hoje. E só junta os pedaços que foram LIDOS — pedaço não lido não vira zero.
  const pedacos = [];
  if (contacts) pedacos.push(`${contacts.length} ${tr(contacts.length === 1 ? "contact on file" : "contacts on file")}`);
  if (ganhos) pedacos.push(`${ganhos.length} ${tr(ganhos.length === 1 ? "deal won" : "deals won")} (${money(wonVal)})`);
  if (typeof frios === "number") pedacos.push(`${frios} ${tr(frios === 1 ? "customer going cold" : "customers going cold")}`);
  if (radar) pedacos.push(`${risky} ${tr(risky === 1 ? "likely no-show in the next 7 days" : "likely no-shows in the next 7 days")}`);
  const brief = pedacos.join(" · ");

  return (
    <div className="space-y-4 stagger">
      {demo && <div className="rounded-xl border border-g-gold/25 bg-g-gold/[0.06] px-4 py-2.5 text-[11px] font-bold text-g-muted">{tr("Demo — sample data. Connect your account in Settings to see your real numbers here.")}</div>}
      {algumaFalha && (
        <div className="rounded-xl border border-[#e0855f]/40 bg-[#e0855f]/[0.08] px-3.5 py-2.5 flex flex-wrap items-center gap-3 text-[12px] text-[#e0855f]">
          <span className="flex-1 min-w-[12rem]">{tr("Some numbers couldn't be read just now. A dash means not read — it does not mean zero.")}</span>
          <button onClick={() => setSeq((n) => n + 1)} className="btn-ghost text-xs shrink-0">{tr("↻ Try again")}</button>
        </div>
      )}
      {loaded && brief && (
        <Card className="bg-white/[0.03]">
          <div className="text-[11px] font-black uppercase tracking-wide text-g-gold mb-1.5">📋 {tr("Where you stand today")}</div>
          <p className="text-[14px] leading-relaxed text-g-ink">{brief}</p>
        </Card>
      )}
      {nba.length > 0 && (
        <Card className="border-g-gold/30 bg-g-gold/[0.06]">
          <div className="text-[11px] font-black uppercase tracking-wide text-g-gold mb-2">⚡ {tr("Next best actions")}</div>
          <div className="space-y-2">
            {nba.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                <span className="text-lg shrink-0">{a.icon}</span>
                <div className="flex-1 min-w-0 text-[13px] font-semibold text-g-word truncate">{a.label}</div>
                <button onClick={a.act} className="btn-bright text-[12px] shrink-0 whitespace-nowrap">{a.cta}</button>
              </div>
            ))}
          </div>
        </Card>
      )}
      {!loaded ? (
        <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Card key={i}><div className="h-3 w-20 rounded bg-white/10 animate-pulse" /><div className="h-7 w-24 rounded bg-white/[0.07] animate-pulse mt-2" /></Card>)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card tone="green"><div className="text-[11px] uppercase tracking-wide text-g-muted">{tr("Revenue won")}</div><div className="text-2xl font-extrabold text-g-green money-glow mt-1">{ou(wonVal, money)}</div></Card>
          <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">{tr("Pipeline value")}</div><div className="text-2xl font-extrabold text-g-word mt-1">{ou(openVal, money)}</div></Card>
          <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">{tr("Lifetime value")}</div><div className="text-2xl font-extrabold text-g-light mt-1">{ou(ltv, money)}</div></Card>
        </div>
      )}
      {loaded && <MiniStats items={[["Contacts", ou(contacts, (c) => `${c.length}`)], ["Active leads", ou(leads, String), "good"], ["At churn risk", ou(frios, String), frios ? "bad" : undefined], ["No-show risk", ou(radar, (r) => `${r.highRisk}`), radar && radar.highRisk ? "bad" : undefined]]} />}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">🔮 {tr("No-show risk radar")}</span><span className="text-[11px] text-g-muted hidden sm:inline">{tr("next 7 days")}</span></div>
        <div className="divide-y divide-white/[0.06]">
          {!loaded ? <div className="px-5 py-6"><div className="h-3 w-1/2 rounded bg-white/10 animate-pulse" /></div>
            : radar === null ? <Empty icon="📡" text={tr("I couldn't read the no-show radar just now — this is not an all-clear.")} />
              : radar === false ? <Empty icon="🔮" text={tr("The no-show radar isn't switched on for your account yet.")} />
              : radar.appointments.length ? radar.appointments.slice(0, 6).map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className={`grid place-items-center h-9 w-9 rounded-full text-[12px] font-black shrink-0 ${riskCls(a.risk || 0)}`}>{a.risk || 0}</span>
                  <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{a.customer_name || a.customer_contact || tr("Unnamed contact")}</div><div className="text-[11px] text-g-muted truncate">{a.reason || ""}{a.starts_at ? ` · ${new Date(a.starts_at).toLocaleString(LOCALE[UI_LANG] || "en-US")}` : ""}</div></div>
                </div>
              )) : <Empty icon="🔮" text={demo ? tr("As bookings come in, Gui ranks the ones most likely to ghost — so you can over-confirm them first.") : tr("No upcoming bookings to score yet — Gui flags the risky ones here automatically.")} />}
        </div>
      </Card>
      <div className="text-center"><button onClick={() => onNav?.("crm")} className="btn-ghost text-sm">{tr("Open the CRM 360 →")}</button></div>
    </div>
  );
}

export default CommandCenter;
