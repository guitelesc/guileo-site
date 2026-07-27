import { useEffect, useState } from "react";

// 🏢 Company OS — Guileo roda na Guileo. Os 8 departamentos da PRÓPRIA companhia, cada um
// com seu KPI real puxado de dados que JÁ existem no cérebro unificado (admin-gated).
// Sales + Support são OPERACIONAIS (clicar abre painel acionável). Light theme casando com CompanyFinance.jsx.
const money = (c) => "$" + (Number(c || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const SALES_ORDER = ["inquiry", "quoted", "booked", "won", "lost"];
const NEXT_STAGE = { inquiry: "quoted", quoted: "booked", booked: "won" }; // won/lost = terminal
const ageLabel = (iso) => {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms) || ms < 0) return "agora";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `há ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
};
const OPERABLE = new Set(["sales", "support", "growth", "operations", "ops", "marketing", "crm", "intelligence"]);
const scoreTone = (n) => (n >= 85 ? "#3E9468" : n >= 70 ? "#e0855f" : "#c8623c");
const isOps = (k) => k === "operations" || k === "ops";
const fmtWhen = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export default function CompanyOS({ token }) {
  const [depts, setDepts] = useState([]);
  const [state, setState] = useState("loading");
  const [open, setOpen] = useState(null); // null | "sales" | "support" | "growth" | "operations"
  const [msg, setMsg] = useState("");

  // command-center brief
  const [brief, setBrief] = useState(null);
  const [briefState, setBriefState] = useState("loading");

  // ── autonomy & agent-health section ──
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoState, setAutoState] = useState("idle"); // idle|loading|ok|err
  const [health, setHealth] = useState(null); // { ready, count, unhealthy:[] }
  const [levels, setLevels] = useState([]); // [{ client_email, level }]
  const [autoEmail, setAutoEmail] = useState("");
  const [autoLevel, setAutoLevel] = useState("safe");
  const [autoSaving, setAutoSaving] = useState(false);

  // sales panel
  const [sales, setSales] = useState(null); // { ready, stages, deals }
  const [salesState, setSalesState] = useState("idle");
  const [busyDeal, setBusyDeal] = useState(null);
  // support panel
  const [tickets, setTickets] = useState(null);
  const [supState, setSupState] = useState("idle");
  const [busyTicket, setBusyTicket] = useState(null);
  // growth panel
  const [growth, setGrowth] = useState(null); // array of at-risk contacts
  const [growthState, setGrowthState] = useState("idle");
  const [busyContact, setBusyContact] = useState(null);
  // operations panel
  const [appts, setAppts] = useState(null); // array of upcoming appointments
  const [opsState, setOpsState] = useState("idle");
  const [busyAppt, setBusyAppt] = useState(null);
  // marketing panel
  const [leads, setLeads] = useState(null); // array of new leads to nurture
  const [mktState, setMktState] = useState("idle");
  const [busyLead, setBusyLead] = useState(null);
  // crm panel
  const [vips, setVips] = useState(null); // array of VIPs pending recognition
  const [crmState, setCrmState] = useState("idle");
  const [busyVip, setBusyVip] = useState(null);
  // intelligence panel (reuses /api/agent-eval, NOT company-os)
  const [intel, setIntel] = useState(null); // { agents, ran_at, has_key } | { err }
  const [intelState, setIntelState] = useState("idle");
  const [evalRunning, setEvalRunning] = useState(false);

  const call = (body) => fetch("/api/company-os", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...body }) }).then((r) => r.json());
  const toast = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3200); };

  const load = async () => {
    setState("loading");
    try {
      const r = await call({ action: "departments" });
      if (r.error || !Array.isArray(r.departments)) { setState("err"); return; }
      setDepts(r.departments); setState("ok");
    } catch { setState("err"); }
  };
  const loadBrief = async () => {
    setBriefState("loading");
    try {
      const r = await call({ action: "brief" });
      if (r.error || r.ready === false) { setBriefState("err"); return; }
      setBrief(r); setBriefState("ok");
    } catch { setBriefState("err"); }
  };
  useEffect(() => { load(); loadBrief(); /* eslint-disable-next-line */ }, [token]);

  // ── AUTONOMY & AGENT HEALTH ──
  const loadAutonomy = async () => {
    setAutoState("loading");
    try {
      const [h, a] = await Promise.all([call({ action: "agents_health" }), call({ action: "autonomy" })]);
      if (h.error || a.error) { setAutoState("err"); return; }
      setHealth({ ready: h.ready !== false, count: Number(h.count ?? (h.unhealthy || []).length), unhealthy: Array.isArray(h.unhealthy) ? h.unhealthy : [] });
      setLevels(Array.isArray(a.levels) ? a.levels : []);
      setAutoState("ok");
    } catch { setAutoState("err"); }
  };
  const toggleAutonomy = () => {
    setAutoOpen((o) => {
      const next = !o;
      if (next && autoState === "idle") loadAutonomy();
      return next;
    });
  };
  const saveAutonomy = async () => {
    if (autoSaving) return;
    const email = autoEmail.trim();
    if (!email.includes("@")) { toast("E-mail inválido (precisa ter @)."); return; }
    if (!["off", "safe", "full"].includes(autoLevel)) { toast("Nível inválido."); return; }
    setAutoSaving(true);
    try {
      const r = await call({ action: "autonomy_set", email, level: autoLevel });
      if (r.error || !r.ok) { toast("Não deu pra salvar: " + (r.error || "erro")); return; }
      toast(`Autonomia de ${r.client_email || email}: ${r.level || autoLevel} ✓`);
      setAutoEmail("");
      await loadAutonomy(); // refresh overrides
    } catch { toast("Falha de rede ao salvar autonomia."); }
    finally { setAutoSaving(false); }
  };

  // ── SALES ──
  const loadSales = async () => {
    setSalesState("loading");
    try {
      const r = await call({ action: "sales" });
      if (r.error) { setSalesState("err"); return; }
      setSales({ ready: r.ready !== false, stages: r.stages || [], deals: r.deals || [] });
      setSalesState("ok");
    } catch { setSalesState("err"); }
  };
  const advanceDeal = async (deal) => {
    const next = NEXT_STAGE[deal.stage];
    if (!next || !sales) return;
    if (!sales.deals.some((d) => d.id === deal.id)) return; // id must exist in state
    const prev = sales.deals;
    setBusyDeal(deal.id);
    // optimistic
    setSales((s) => ({ ...s, deals: s.deals.map((d) => d.id === deal.id ? { ...d, stage: next } : d) }));
    try {
      const r = await call({ action: "deal_move", deal_id: deal.id, stage: next });
      if (r.error || !r.ok) { setSales((s) => ({ ...s, deals: prev })); toast("Não deu pra avançar: " + (r.error || "erro")); return; }
      // sync from server truth, then refetch stage strip
      setSales((s) => ({ ...s, deals: s.deals.map((d) => d.id === deal.id ? { ...d, stage: r.stage || next, status: r.status || d.status } : d) }));
      toast(`→ ${next} ✓`);
      loadSales();
    } catch { setSales((s) => ({ ...s, deals: prev })); toast("Falha de rede ao avançar."); }
    finally { setBusyDeal(null); }
  };
  const followupDeal = async (deal) => {
    if (!sales || !sales.deals.some((d) => d.id === deal.id)) return;
    setBusyDeal(deal.id);
    toast("Gui vai dar follow-up ✓"); // optimistic
    try {
      const r = await call({ action: "deal_followup", deal_id: deal.id });
      if (r.error || !r.ok) toast("Follow-up não saiu: " + (r.error || "erro"));
      else if (r.via === "email" && r.sent) toast("Gui deu follow-up por e-mail ✓");
    } catch { toast("Falha de rede no follow-up."); }
    finally { setBusyDeal(null); }
  };

  // ── SUPPORT ──
  const loadSupport = async () => {
    setSupState("loading");
    try {
      const r = await call({ action: "support" });
      if (r.error) { setSupState("err"); return; }
      const rows = (r.tickets || []).filter((t) => ["open", "resolving", "escalated"].includes(t.status));
      setTickets(rows);
      setSupState("ok");
    } catch { setSupState("err"); }
  };
  const patchTicket = (id, patch) => setTickets((ts) => (ts || []).map((t) => t.id === id ? { ...t, ...patch } : t));
  const resolveTicket = async (t) => {
    if (!tickets || !tickets.some((x) => x.id === t.id)) return;
    const prev = tickets;
    setBusyTicket(t.id);
    setTickets((ts) => ts.filter((x) => x.id !== t.id)); // optimistic remove (resolved leaves the queue)
    try {
      const r = await call({ action: "ticket_set", id: t.id, status: "resolved" });
      if (r.error || !r.ok) { setTickets(prev); toast("Não deu pra resolver: " + (r.error || "erro")); return; }
      toast("Ticket resolvido ✓");
    } catch { setTickets(prev); toast("Falha de rede ao resolver."); }
    finally { setBusyTicket(null); }
  };
  const guiReply = async (t) => {
    if (!tickets || !tickets.some((x) => x.id === t.id)) return;
    const prev = tickets;
    setBusyTicket(t.id);
    patchTicket(t.id, { status: "resolving" }); // optimistic
    const text = "Oi! A Gui aqui — já estou cuidando disso pra você. Retorno em instantes com a solução.";
    try {
      const rr = await call({ action: "ticket_reply", id: t.id, text, role: "gui" });
      if (rr.error || !rr.ok) { setTickets(prev); toast("Resposta não saiu: " + (rr.error || "erro")); return; }
      const rs = await call({ action: "ticket_set", id: t.id, status: "resolving" });
      if (rs.error || !rs.ok) { toast("Respondeu, mas status não mudou."); return; }
      toast("Gui respondeu ✓");
    } catch { setTickets(prev); toast("Falha de rede ao responder."); }
    finally { setBusyTicket(null); }
  };

  // ── GROWTH ──
  const loadGrowth = async () => {
    setGrowthState("loading");
    try {
      const r = await call({ action: "growth" });
      if (r.error || r.ready === false) { setGrowthState("err"); return; }
      setGrowth(r.atRisk || []);
      setGrowthState("ok");
    } catch { setGrowthState("err"); }
  };
  const reengage = async (c) => {
    if (!growth || !growth.some((x) => x.contact_id === c.contact_id)) return;
    const prev = growth;
    setBusyContact(c.contact_id);
    setGrowth((g) => (g || []).filter((x) => x.contact_id !== c.contact_id)); // optimistic remove
    try {
      const r = await call({ action: "growth_reengage", contact_id: c.contact_id });
      if (r.error || !r.ok) { setGrowth(prev); toast("Não deu pra reativar: " + (r.error || "erro")); return; }
      toast(r.via === "email" ? "Gui reativou por e-mail ✓" : "Gui na fila ✓");
    } catch { setGrowth(prev); toast("Falha de rede ao reativar."); }
    finally { setBusyContact(null); }
  };

  // ── OPERATIONS ──
  const loadOps = async () => {
    setOpsState("loading");
    try {
      const r = await call({ action: "ops" });
      if (r.error || r.ready === false) { setOpsState("err"); return; }
      setAppts(r.appointments || []);
      setOpsState("ok");
    } catch { setOpsState("err"); }
  };
  const remindAppt = async (a) => {
    if (!appts || !appts.some((x) => x.id === a.id)) return;
    setBusyAppt(a.id);
    toast("Gui vai lembrar por e-mail ✓"); // optimistic
    try {
      const r = await call({ action: "ops_remind", appt_id: a.id });
      if (r.error || !r.ok) toast("Lembrete não saiu: " + (r.error || "erro"));
      else if (r.via && r.via !== "email") toast("Lembrete na fila ✓");
    } catch { toast("Falha de rede no lembrete."); }
    finally { setBusyAppt(null); }
  };

  // ── MARKETING ──
  const loadMarketing = async () => {
    setMktState("loading");
    try {
      const r = await call({ action: "marketing" });
      if (r.error || r.ready === false) { setMktState("err"); return; }
      setLeads(r.leads || []);
      setMktState("ok");
    } catch { setMktState("err"); }
  };
  const nurtureLead = async (l) => {
    if (!leads || !leads.some((x) => x.contact_id === l.contact_id)) return;
    const prev = leads;
    setBusyLead(l.contact_id);
    setLeads((g) => (g || []).filter((x) => x.contact_id !== l.contact_id)); // optimistic remove
    try {
      const r = await call({ action: "marketing_nurture", contact_id: l.contact_id });
      if (r.error || !r.ok) { setLeads(prev); toast("Não deu pra nutrir: " + (r.error || "erro")); return; }
      toast(r.via === "email" ? "Gui nutriu o lead por e-mail ✓" : "Gui na fila ✓");
    } catch { setLeads(prev); toast("Falha de rede ao nutrir."); }
    finally { setBusyLead(null); }
  };

  // ── CRM ──
  const loadCrm = async () => {
    setCrmState("loading");
    try {
      const r = await call({ action: "crm" });
      if (r.error || r.ready === false) { setCrmState("err"); return; }
      setVips(r.vips || []);
      setCrmState("ok");
    } catch { setCrmState("err"); }
  };
  const thankVip = async (v) => {
    if (!vips || !vips.some((x) => x.contact_id === v.contact_id)) return;
    const prev = vips;
    setBusyVip(v.contact_id);
    setVips((g) => (g || []).filter((x) => x.contact_id !== v.contact_id)); // optimistic remove
    try {
      const r = await call({ action: "crm_thank", contact_id: v.contact_id });
      if (r.error || !r.ok) { setVips(prev); toast("Não deu pra agradecer: " + (r.error || "erro")); return; }
      toast("Gui agradeceu o cliente ✓");
    } catch { setVips(prev); toast("Falha de rede ao agradecer."); }
    finally { setBusyVip(null); }
  };

  // ── INTELLIGENCE ── (reuses /api/agent-eval, NOT company-os)
  const evalCall = (action) => fetch("/api/agent-eval", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, token }) }).then((r) => r.json());
  const loadIntel = async () => {
    setIntelState("loading");
    try {
      const r = await evalCall("latest");
      if (r.error) { setIntelState("err"); return; }
      setIntel({ agents: Array.isArray(r.agents) ? r.agents : [], ran_at: r.ran_at || null, has_key: r.has_key !== false, note: r.note || "" });
      setIntelState("ok");
    } catch { setIntelState("err"); }
  };
  const runEval = async () => {
    if (evalRunning) return;
    setEvalRunning(true);
    toast("Rodando eval… pode levar 1-2 min");
    try {
      const r = await evalCall("run");
      if (r.error) { toast("Eval não rodou: " + r.error); return; }
      toast("Eval concluído ✓");
      await loadIntel(); // refetch the fresh scoreboard
    } catch { toast("Falha de rede ao rodar eval."); }
    finally { setEvalRunning(false); }
  };

  const toggle = (key) => {
    if (!OPERABLE.has(key)) return;
    setOpen((o) => {
      const next = o === key ? null : key;
      if (next === "sales" && salesState === "idle") loadSales();
      if (next === "support" && supState === "idle") loadSupport();
      if (next === "growth" && growthState === "idle") loadGrowth();
      if (isOps(next) && opsState === "idle") loadOps();
      if (next === "marketing" && mktState === "idle") loadMarketing();
      if (next === "crm" && crmState === "idle") loadCrm();
      if (next === "intelligence" && intelState === "idle") loadIntel();
      return next;
    });
  };
  // deep-links from the brief strip → open the matching panel
  const openPanel = (key) => { if (open !== key) toggle(key); };

  const statusTone = (s) => s === "escalated" ? "bg-[#c8623c]/10 text-[#c8623c]" : s === "resolving" ? "bg-sky-500/10 text-sky-600" : "bg-g-gold/10 text-g-gold";
  const prioTone = (p) => p === "urgent" ? "text-[#c8623c]" : p === "high" ? "text-[#e0855f]" : "text-g-muted";
  const stageTone = (s) => s === "won" ? "text-g-green" : s === "lost" ? "text-[#c8623c]" : s === "booked" ? "text-sky-600" : "text-g-muted";

  return (
    <div className="mt-6 rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">🏢 Company OS · Departamentos</div>
          <p className="text-[12px] text-g-muted">A Guileo rodando na Guileo — Vendas e Suporte são operacionais (clique pra abrir).</p>
        </div>
        <button onClick={load} className="rounded-full border border-g-line px-3 py-1.5 text-[12px] font-bold text-g-muted hover:text-g-word">↻</button>
      </div>

      {msg && <div className="mt-3 rounded-lg border border-g-line bg-white/[0.05] px-3 py-2 text-[12px] font-bold text-g-word">{msg}</div>}

      {/* ── 🧭 COMMAND-CENTER BRIEF ── */}
      {briefState === "loading" && <div className="mt-4 text-[12px] text-g-muted">🧭 Levantando o que precisa de atenção…</div>}
      {briefState === "ok" && brief && (() => {
        const pills = [
          { key: "deals", label: "Deals parados", n: brief.stale_deals?.count ?? 0, sub: money(brief.stale_deals?.value_cents), onClick: () => openPanel("sales") },
          { key: "tickets", label: "Tickets abertos", n: brief.open_tickets ?? 0, onClick: () => openPanel("support") },
          { key: "churn", label: "Em risco de churn", n: brief.churn_risk ?? 0, onClick: () => openPanel("growth") },
          { key: "appts", label: "Agendamentos 24h", n: brief.appts_24h ?? 0, onClick: () => openPanel("operations") },
          { key: "leads", label: "Leads novos 48h", n: brief.new_leads_48h ?? 0 },
        ];
        return (
          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">🧭 O que precisa de atenção agora</div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {pills.map((p) => {
                const hot = (p.n ?? 0) > 0;
                const clickable = !!p.onClick;
                return (
                  <div
                    key={p.key}
                    onClick={p.onClick}
                    className={`rounded-xl border px-3 py-2.5 transition ${clickable ? "cursor-pointer hover:border-g-gold" : ""} ${hot ? "border-[#e0855f]/40 bg-[#e0855f]/[0.06]" : "border-g-line bg-white/[0.03]"}`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wide text-g-muted">{p.label}</div>
                    <div className="mt-0.5 flex items-baseline gap-1.5">
                      <span className="text-[22px] font-black tabular-nums leading-none" style={{ color: hot ? "#c8623c" : "#9a9488" }}>{p.n}</span>
                      {p.sub && <span className="text-[10.5px] font-bold tabular-nums text-g-muted/80">{p.sub}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── 🎚️ AUTONOMIA & SAÚDE DOS AGENTES ── */}
      <div className="mt-4 rounded-xl border border-g-line bg-white/[0.03]">
        <div
          onClick={toggleAutonomy}
          className="flex cursor-pointer items-center justify-between px-4 py-3 hover:border-g-gold"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">🎚️ Autonomia &amp; Saúde dos Agentes</div>
          <span className="text-[11px] font-bold text-g-gold">{autoOpen ? "▾" : "▸"}</span>
        </div>

        {autoOpen && (
          <div className="border-t border-g-line px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wide text-g-muted">Controle por cliente · dinheiro nunca é automático</div>
              <button onClick={loadAutonomy} className="rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold text-g-muted hover:text-g-word">↻</button>
            </div>

            {autoState === "loading" && <div className="mt-3 text-[13px] text-g-muted">Carregando…</div>}
            {autoState === "err" && <div className="mt-3 text-[13px] text-[#c8623c]">Não consegui carregar a autonomia / saúde dos agentes.</div>}

            {autoState === "ok" && (
              <>
                {/* agent health */}
                {health && health.count > 0 ? (
                  <div className="mt-3 rounded-xl border border-[#e0855f]/40 bg-[#e0855f]/[0.06] px-3.5 py-3">
                    <div className="text-[12px] font-bold text-[#c8623c]">{health.count} agente(s) precisam de re-treino</div>
                    <div className="mt-2 space-y-1">
                      {(health.unhealthy || []).map((u, i) => (
                        <div key={u.email || i} className="text-[11px] text-g-word">
                          <span className="font-bold">{u.business || u.email || "(agente)"}</span>
                          <span className="text-g-muted"> — {u.reason || "config incompleta"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-g-green/30 bg-g-green/[0.06] px-3.5 py-3 text-[12px] font-bold text-g-green">Todos os agentes saudáveis 💚</div>
                )}

                {/* explainer */}
                <div className="mt-4 rounded-lg border border-g-line bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-g-muted">
                  <span className="font-bold text-g-word">off</span> = pausado ·{" "}
                  <span className="font-bold text-g-word">safe</span> = age sozinha só no seguro (email) ·{" "}
                  <span className="font-bold text-g-word">full</span> = libera voz/SMS quando A2P ligar. Dinheiro nunca é automático.
                </div>

                {/* set form */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="email"
                    value={autoEmail}
                    onChange={(e) => setAutoEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="min-w-0 flex-1 rounded-full border border-g-line bg-white/[0.04] px-3.5 py-1.5 text-[12px] text-g-word placeholder:text-g-muted/60 focus:border-g-gold focus:outline-none"
                  />
                  <select
                    value={autoLevel}
                    onChange={(e) => setAutoLevel(e.target.value)}
                    className="rounded-full border border-g-line bg-white/[0.04] px-3 py-1.5 text-[12px] font-bold text-g-word focus:border-g-gold focus:outline-none"
                  >
                    <option value="off">off · pausado</option>
                    <option value="safe">safe · email</option>
                    <option value="full">full · voz/SMS</option>
                  </select>
                  <button
                    onClick={saveAutonomy}
                    disabled={autoSaving}
                    className="rounded-full bg-gradient-to-r from-g-gold to-[#e0855f] px-3.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                  >{autoSaving ? "Salvando…" : "Salvar"}</button>
                </div>

                {/* current overrides */}
                <div className="mt-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-g-muted">Overrides ativos (não listados = safe)</div>
                  {(levels || []).length === 0 ? (
                    <div className="mt-1.5 text-[12px] text-g-muted">Nenhum override — todos os clientes no padrão (safe).</div>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {levels.map((l) => {
                        const tone = l.level === "off" ? "bg-[#c8623c]/10 text-[#c8623c]" : l.level === "full" ? "bg-sky-500/10 text-sky-600" : "bg-g-green/10 text-g-green";
                        return (
                          <span key={l.client_email} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>
                            {l.client_email}: {l.level}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {state === "loading" && <div className="mt-4 text-[13px] text-g-muted">Carregando…</div>}
      {state === "err" && <div className="mt-4 text-[13px] text-[#c8623c]">Não consegui carregar — confira o token de admin (ou aplique db/company_os_departments.sql).</div>}

      {state === "ok" && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {depts.map((d) => {
            const operable = OPERABLE.has(d.key);
            const active = open === d.key;
            return (
              <div
                key={d.key}
                onClick={() => toggle(d.key)}
                className={`rounded-xl border px-3.5 py-3 transition ${operable ? "cursor-pointer hover:border-g-gold" : ""} ${active ? "border-g-gold ring-1 ring-g-gold/40 bg-white/[0.05]" : "border-g-line bg-white/[0.03]"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px]">{d.icon}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{d.label}</span>
                  </div>
                  {operable
                    ? <span className="text-[11px] font-bold text-g-gold">{active ? "▾" : "▸"}</span>
                    : <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${d.ready ? "bg-g-green/10 text-g-green" : "bg-g-muted/10 text-g-muted"}`}>{d.ready ? "live" : "aguardando"}</span>}
                </div>
                <div className="mt-2 text-[22px] font-black tabular-nums leading-none" style={{ color: d.ready ? (d.accent || "#161512") : "#9a9488" }}>{d.kpi_value}</div>
                <div className="mt-1 text-[10.5px] text-g-muted/80">{d.kpi_label}{operable ? " · clique pra operar" : ""}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 💼 SALES PANEL ── */}
      {state === "ok" && open === "sales" && (
        <div className="mt-3 rounded-xl border border-g-gold/40 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">💼 Pipeline de vendas</div>
            <button onClick={loadSales} className="rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold text-g-muted hover:text-g-word">↻</button>
          </div>

          {salesState === "loading" && <div className="mt-3 text-[13px] text-g-muted">Carregando…</div>}
          {salesState === "err" && <div className="mt-3 text-[13px] text-[#c8623c]">Não consegui carregar o pipeline.</div>}

          {salesState === "ok" && sales && (
            <>
              {/* stage strip */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {[...(sales.stages || [])].sort((a, b) => (a.ord ?? SALES_ORDER.indexOf(a.stage)) - (b.ord ?? SALES_ORDER.indexOf(b.stage))).map((s) => (
                  <div key={s.stage} className="rounded-lg border border-g-line bg-white/[0.03] px-2.5 py-2">
                    <div className={`text-[10px] font-bold uppercase tracking-wide ${stageTone(s.stage)}`}>{s.stage}</div>
                    <div className="mt-0.5 text-[15px] font-black tabular-nums text-g-word">{s.count ?? 0}</div>
                    <div className="text-[10px] text-g-muted/70 tabular-nums">{money(s.value_cents)}</div>
                  </div>
                ))}
              </div>

              {/* deals list */}
              <div className="mt-3 space-y-1.5">
                {(sales.deals || []).length === 0
                  ? <div className="py-4 text-center text-[13px] text-g-muted">Nenhum negócio em aberto.</div>
                  : sales.deals.map((d) => {
                    const terminal = d.stage === "won" || d.stage === "lost";
                    const busy = busyDeal === d.id;
                    return (
                      <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-g-line bg-white/[0.03] px-3.5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-bold text-g-word">{d.title || "(sem título)"} · <span className="tabular-nums text-g-green">{money(d.value_cents)}</span></div>
                          <div className="text-[10.5px] text-g-muted">
                            {d.tenant || "—"} · <span className={`font-bold uppercase ${stageTone(d.stage)}`}>{d.stage}</span> · há {d.days_stale ?? 0}d{d.contact ? " · " + d.contact : ""}
                          </div>
                        </div>
                        <button
                          onClick={() => advanceDeal(d)}
                          disabled={terminal || busy}
                          className="rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold text-g-word hover:border-g-gold disabled:opacity-40 disabled:hover:border-g-line"
                        >→ Avançar</button>
                        <button
                          onClick={() => followupDeal(d)}
                          disabled={busy}
                          className="rounded-full bg-gradient-to-r from-g-gold to-[#e0855f] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                        >Gui follow-up</button>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 🎧 SUPPORT PANEL ── */}
      {state === "ok" && open === "support" && (
        <div className="mt-3 rounded-xl border border-g-gold/40 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">🎧 Fila de suporte</div>
            <button onClick={loadSupport} className="rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold text-g-muted hover:text-g-word">↻</button>
          </div>

          {supState === "loading" && <div className="mt-3 text-[13px] text-g-muted">Carregando…</div>}
          {supState === "err" && <div className="mt-3 text-[13px] text-[#c8623c]">Não consegui carregar a fila.</div>}

          {supState === "ok" && (
            <div className="mt-3 space-y-1.5">
              {(tickets || []).length === 0
                ? <div className="py-4 text-center text-[13px] text-g-muted">Fila zerada — nenhum ticket em aberto. 🎉</div>
                : tickets.map((t) => {
                  const busy = busyTicket === t.id;
                  return (
                    <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-g-line bg-white/[0.03] px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-g-word">{t.subject || "(sem assunto)"}</div>
                        <div className="text-[10.5px] text-g-muted">
                          {t.client_email || "—"} · {t.category || "outro"} · <span className={`font-bold uppercase ${prioTone(t.priority)}`}>{t.priority || "normal"}</span> · {ageLabel(t.created_at)}
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusTone(t.status)}`}>{t.status}</span>
                      <button
                        onClick={() => guiReply(t)}
                        disabled={busy}
                        className="rounded-full bg-gradient-to-r from-g-gold to-[#e0855f] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                      >Gui responde</button>
                      <button
                        onClick={() => resolveTicket(t)}
                        disabled={busy}
                        className="rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold text-g-word hover:border-g-green disabled:opacity-40"
                      >Resolver</button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ── 🚀 GROWTH PANEL ── */}
      {state === "ok" && open === "growth" && (
        <div className="mt-3 rounded-xl border border-g-gold/40 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">🚀 Clientes em risco de churn</div>
            <button onClick={loadGrowth} className="rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold text-g-muted hover:text-g-word">↻</button>
          </div>

          {growthState === "loading" && <div className="mt-3 text-[13px] text-g-muted">Carregando…</div>}
          {growthState === "err" && <div className="mt-3 text-[13px] text-[#c8623c]">Não consegui carregar os clientes em risco.</div>}

          {growthState === "ok" && (
            <div className="mt-3 space-y-1.5">
              {(growth || []).length === 0
                ? <div className="py-4 text-center text-[13px] text-g-muted">Ninguém em risco agora 💚</div>
                : growth.map((c) => {
                  const busy = busyContact === c.contact_id;
                  return (
                    <div key={c.contact_id} className="flex flex-wrap items-center gap-2 rounded-xl border border-g-line bg-white/[0.03] px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-g-word">{c.name || "(sem nome)"}{c.email ? " · " : ""}<span className="font-normal text-g-muted">{c.email || ""}</span></div>
                        <div className="text-[10.5px] text-g-muted">
                          {c.tenant || "—"} · <span className="font-bold text-[#c8623c]">{c.risk ?? 0}% risco</span> · há {c.days_since ?? 0}d · <span className="tabular-nums text-g-green">{money((c.ltv || 0) * 100)} LTV</span>
                        </div>
                      </div>
                      <button
                        onClick={() => reengage(c)}
                        disabled={busy}
                        className="rounded-full bg-gradient-to-r from-g-gold to-[#e0855f] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                      >Gui reativa</button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ── ⚙️ OPERATIONS PANEL ── */}
      {state === "ok" && isOps(open) && (
        <div className="mt-3 rounded-xl border border-g-gold/40 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">⚙️ Próximos agendamentos</div>
            <button onClick={loadOps} className="rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold text-g-muted hover:text-g-word">↻</button>
          </div>

          {opsState === "loading" && <div className="mt-3 text-[13px] text-g-muted">Carregando…</div>}
          {opsState === "err" && <div className="mt-3 text-[13px] text-[#c8623c]">Não consegui carregar os agendamentos.</div>}

          {opsState === "ok" && (
            <div className="mt-3 space-y-1.5">
              {(appts || []).length === 0
                ? <div className="py-4 text-center text-[13px] text-g-muted">Nenhum agendamento nas próximas 48h.</div>
                : appts.map((a) => {
                  const busy = busyAppt === a.id;
                  return (
                    <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-g-line bg-white/[0.03] px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-g-word">{a.customer || "(sem nome)"}{a.contact ? " · " : ""}<span className="font-normal text-g-muted">{a.contact || ""}</span></div>
                        <div className="text-[10.5px] text-g-muted">
                          {a.tenant || "—"} · {fmtWhen(a.when)} · <span className="font-bold text-g-gold">em {a.hours_until ?? 0}h</span>
                        </div>
                      </div>
                      <button
                        onClick={() => remindAppt(a)}
                        disabled={busy}
                        className="rounded-full bg-gradient-to-r from-g-gold to-[#e0855f] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                      >Gui lembra</button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ── 📣 MARKETING PANEL ── */}
      {state === "ok" && open === "marketing" && (
        <div className="mt-3 rounded-xl border border-g-gold/40 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">📣 Leads novos pra nutrir</div>
            <button onClick={loadMarketing} className="rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold text-g-muted hover:text-g-word">↻</button>
          </div>

          {mktState === "loading" && <div className="mt-3 text-[13px] text-g-muted">Carregando…</div>}
          {mktState === "err" && <div className="mt-3 text-[13px] text-[#c8623c]">Não consegui carregar os leads.</div>}

          {mktState === "ok" && (
            <div className="mt-3 space-y-1.5">
              {(leads || []).length === 0
                ? <div className="py-4 text-center text-[13px] text-g-muted">Nenhum lead novo pra nutrir agora.</div>
                : leads.map((l) => {
                  const busy = busyLead === l.contact_id;
                  return (
                    <div key={l.contact_id} className="flex flex-wrap items-center gap-2 rounded-xl border border-g-line bg-white/[0.03] px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-g-word">{l.name || "(sem nome)"}{l.email ? " · " : ""}<span className="font-normal text-g-muted">{l.email || ""}</span></div>
                        <div className="text-[10.5px] text-g-muted">
                          {l.tenant || "—"} · <span className="font-bold text-g-gold">{l.source || "—"}</span> · há {l.days_old ?? 0}d
                        </div>
                      </div>
                      <button
                        onClick={() => nurtureLead(l)}
                        disabled={busy}
                        className="rounded-full bg-gradient-to-r from-g-gold to-[#e0855f] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                      >Gui nutre</button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ── 🗂️ CRM PANEL ── */}
      {state === "ok" && open === "crm" && (
        <div className="mt-3 rounded-xl border border-g-gold/40 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">🗂️ VIPs pra reconhecer</div>
            <button onClick={loadCrm} className="rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold text-g-muted hover:text-g-word">↻</button>
          </div>

          {crmState === "loading" && <div className="mt-3 text-[13px] text-g-muted">Carregando…</div>}
          {crmState === "err" && <div className="mt-3 text-[13px] text-[#c8623c]">Não consegui carregar os VIPs.</div>}

          {crmState === "ok" && (
            <div className="mt-3 space-y-1.5">
              {(vips || []).length === 0
                ? <div className="py-4 text-center text-[13px] text-g-muted">Sem VIPs pendentes de reconhecimento.</div>
                : vips.map((v) => {
                  const busy = busyVip === v.contact_id;
                  return (
                    <div key={v.contact_id} className="flex flex-wrap items-center gap-2 rounded-xl border border-g-line bg-white/[0.03] px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-g-word">{v.name || "(sem nome)"}{v.email ? " · " : ""}<span className="font-normal text-g-muted">{v.email || ""}</span></div>
                        <div className="text-[10.5px] text-g-muted">
                          {v.tenant || "—"} · <span className="tabular-nums text-g-green">${v.ltv ?? 0} LTV</span> · {v.visits ?? 0} visitas · <span className="font-bold uppercase text-g-gold">{v.lifecycle || "—"}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => thankVip(v)}
                        disabled={busy}
                        className="rounded-full bg-gradient-to-r from-g-gold to-[#e0855f] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                      >Gui agradece</button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ── 📊 INTELLIGENCE PANEL ── (reuses /api/agent-eval) */}
      {state === "ok" && open === "intelligence" && (
        <div className="mt-3 rounded-xl border border-g-gold/40 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">📊 Placar de qualidade dos agentes</div>
            <button onClick={loadIntel} className="rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold text-g-muted hover:text-g-word">↻</button>
          </div>

          {intelState === "loading" && <div className="mt-3 text-[13px] text-g-muted">Carregando…</div>}
          {intelState === "err" && <div className="mt-3 text-[13px] text-[#c8623c]">Não consegui carregar o placar de evals.</div>}

          {intelState === "ok" && intel && (
            <>
              {intel.has_key === false ? (
                <div className="mt-3 rounded-lg border border-g-line bg-white/[0.02] px-3 py-2.5 text-[12px] text-g-muted">
                  Sem ANTHROPIC_API_KEY — evals não rodam.{intel.note ? " " + intel.note : ""}
                </div>
              ) : (
                <div className="mt-3 space-y-1.5">
                  {(intel.agents || []).length === 0
                    ? <div className="py-4 text-center text-[13px] text-g-muted">Nenhum eval registrado ainda — rode o primeiro.</div>
                    : intel.agents.map((a) => {
                      const score = Math.round(Number(a.avg_score ?? 0));
                      const safety = Math.round(Number(a.avg_safety ?? 0));
                      return (
                        <div key={a.agent} className="flex flex-wrap items-center gap-2 rounded-xl border border-g-line bg-white/[0.03] px-3.5 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-bold uppercase tracking-wide text-g-word">{a.agent}</div>
                            <div className="text-[10.5px] text-g-muted">segurança <span className="font-bold tabular-nums" style={{ color: scoreTone(safety) }}>{safety}</span>/100</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[22px] font-black tabular-nums leading-none" style={{ color: scoreTone(score) }}>{score}</div>
                            <div className="text-[9px] font-bold uppercase tracking-wide text-g-muted/70">/100 score</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10.5px] text-g-muted">Último placar: {fmtWhen(intel.ran_at)}</div>
                <button
                  onClick={runEval}
                  disabled={evalRunning}
                  className="rounded-full bg-gradient-to-r from-g-gold to-[#e0855f] px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                >{evalRunning ? "Rodando… pode levar 1-2 min" : "Rodar eval agora"}</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
