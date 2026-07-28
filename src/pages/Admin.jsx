import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Broto from "../components/Broto.jsx";
import ActivationRunbook from "../components/ActivationRunbook.jsx";
import CompanyFinance from "../components/CompanyFinance.jsx";
import CompanyOS from "../components/CompanyOS.jsx";
import MetaConnect from "../components/MetaConnect.jsx";
import ChannelStatus from "../components/ChannelStatus.jsx";
import QualityPanel from "../components/QualityPanel.jsx";
import WarRoom from "../components/WarRoom.jsx";
import OnboardApprovals from "../components/OnboardApprovals.jsx";
import ClientWallet from "../components/ClientWallet.jsx";
import SellerManager from "../components/SellerManager.jsx";
import DemoEngine from "../components/DemoEngine.jsx";
import { ACTIVATION_STEPS, ACTIVATION_SECTORS, pickL } from "../data/activation.js";

// /admin — Luis's private command center. Simple password gate (basic, frontend-level —
// good enough to keep casual access out of a monitoring view; real auth comes with the
// backend later). Reads the same public gui_actions feed as /live, plus totals.

const supabase = createClient(
  "https://ynihodbknhjirkdogxby.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E",
  { auth: { persistSession: false } }
);

// Second, lightweight client for the AUTH project (ynihodbknhjirkdogxby) where the
// `clients` table lives. Anon key copied from src/lib/supabase.js — public by design.
// NOTE: the `clients` RLS policies only let an `authenticated` user read their OWN row,
// so this anon read will return nothing until Luis adds an admin-read RLS policy (or a
// service-role-backed function). We do NOT put service-role keys in the frontend.
const authSupabase = createClient(
  "https://ynihodbknhjirkdogxby.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E",
  { auth: { persistSession: false } }
);

// SECURITY: the admin password is NOT hardcoded here anymore (would ship in the JS bundle).
// It is verified SERVER-SIDE by the `admin_actions(token)` Postgres RPC, which only returns lead
// data when the token matches; a wrong token raises and re-locks the page. Change the password in
// the DB function (rotate `admin_actions`), not here.
const ICON = { book: "📅", reschedule: "🔁", cancel: "✖️", lead: "🎯", callback: "📞", review: "⭐", sale: "💳", quote: "🧾", order: "🛒", invoice: "🔗", qualify: "🎯", confirm: "✅", winback: "💚", noshow: "🔄", info: "💬" };
const LABEL = { book: "Booked", reschedule: "Rescheduled", cancel: "Cancelled", lead: "Lead", callback: "Callback", review: "Review", sale: "Sale", quote: "Quote", order: "Order", invoice: "Payment link", qualify: "Qualified", confirm: "Confirmed", winback: "Win-back", noshow: "No-show", info: "Info" };

export default function Admin() {
  const [token, setToken] = useState(() => { try { return sessionStorage.getItem("guileo_admin_tok") || ""; } catch { return ""; } });
  const [unlocked, setUnlocked] = useState(() => { try { return !!sessionStorage.getItem("guileo_admin_tok"); } catch { return false; } });
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading");
  const [clients, setClients] = useState([]);
  const [clientsState, setClientsState] = useState("loading"); // loading | ok | err
  const [sentMap, setSentMap] = useState({}); // `${id}:${step}` -> "sending" | "ok" | "err"
  // connection-code lookup (hand the code to a client → their portal flips to REAL data)
  const [keyEmail, setKeyEmail] = useState("");
  const [keyResult, setKeyResult] = useState(null); // { email, key } | null
  const [keyState, setKeyState] = useState("idle"); // idle | busy | err | copied
  // Reactivation Blitz — upload a dormant client list, watch the money come back
  const [blitzEmail, setBlitzEmail] = useState("");      // whose list this is (client email)
  const [blitzList, setBlitzList] = useState("");        // pasted contacts, one per line
  const [blitzState, setBlitzState] = useState("idle");  // idle | busy | err
  const [blitzMsg, setBlitzMsg] = useState("");          // upload result note
  const [blitzStats, setBlitzStats] = useState(null);    // { total, pending, contacted, replied, won }
  const [journey, setJourney] = useState(null);          // { demo, onboarding, retention } — unified funnel
  const [statsState, setStatsState] = useState("idle");  // idle | busy | err
  const [realEvents, setRealEvents] = useState([]); // platform-wide REAL events (calls, payments, messages)
  const [siteStats, setSiteStats] = useState(null); // visit analytics (privacy-first, own beacon)
  const [lastSync, setLastSync] = useState(null); // when the token-gated feeds last returned (REAL)
  const [tick, setTick] = useState(0); // ↻ manual refresh — bump forces the live loader to re-run now
  // Onboard a client — one form turns a paying client live (agent + number + code + profile)
  const [ob, setOb] = useState({ email: "", business: "", industry: "", agent_name: "", lang: "pt", plan: "Personalized", credits: "440", brain: "", review_link: "", forward_number: "", number_mode: "buy", existing_number: "", area_code: "" });
  const [obState, setObState] = useState("idle"); // idle | busy | done | err
  const [obResult, setObResult] = useState(null);
  const [planState, setPlanState] = useState("idle"); // idle | busy | done | err
  const [planResult, setPlanResult] = useState(null);
  const [tab, setTab] = useState("overview"); // active cockpit tab (layout-only reorg — nada muda de comportamento)

  // 1-click: send a branded nurture email (welcome/proof/proposal/reengage) to a lead.
  const nurture = async (r, step) => {
    const to = (r.contact || "").trim();
    if (!to.includes("@")) return;
    const k = `${r.id}:${step}`;
    setSentMap((m) => ({ ...m, [k]: "sending" }));
    try {
      const res = await fetch("/api/nurture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, name: r.name || "there", business: r.business || "your business", lang: "pt", step }) });
      const d = await res.json().catch(() => ({}));
      setSentMap((m) => ({ ...m, [k]: d.ok ? "ok" : "err" }));
    } catch { setSentMap((m) => ({ ...m, [k]: "err" })); }
  };

  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    const load = async () => {
      // SECURITY: full lead data comes only via the token-gated SECURITY-DEFINER RPC. A wrong
      // token raises → we clear the session and re-lock (real server-side auth, not a client check).
      const { data, error } = await supabase.rpc("admin_actions", { p_token: token });
      if (!alive) return;
      if (error) {
        try { sessionStorage.removeItem("guileo_admin_tok"); } catch { /* */ }
        setToken(""); setUnlocked(false); setPass(""); setErr("Wrong password"); return;
      }
      setRows(data || []); setState("ok");
      // platform-wide REAL events (calls / payments / messages across all clients) — same token gate
      const ev = await supabase.rpc("admin_all_events", { p_token: token });
      if (alive && !ev.error) setRealEvents(ev.data || []);
      const st = await supabase.rpc("admin_site_stats", { p_token: token });
      if (alive && !st.error) setSiteStats(st.data || null);
      // unified lead journey: demo → onboarding → retention (one token-gated aggregate)
      const jr = await supabase.rpc("admin_journey", { p_token: token });
      if (alive && !jr.error) setJourney(jr.data || null);
      if (alive) setLastSync(new Date()); // stamp: the REAL feeds just refreshed
    };
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [unlocked, token, tick]);

  // Registered clients (AUTH project). Graceful: anon reads are blocked by the current
  // RLS policies, so this falls back to a muted "not set up yet" note until an admin-read
  // policy (or service-role function) exists.
  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    const loadClients = async () => {
      try {
        const { data, error } = await authSupabase
          .from("clients")
          .select("uid,email,name,business,sector,plan,created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (!alive) return;
        if (error) { setClientsState("err"); return; }
        setClients(data || []); setClientsState("ok");
      } catch { if (alive) setClientsState("err"); }
    };
    loadClients();
    const id = setInterval(loadClients, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [unlocked]);

  if (!unlocked) {
    return (
      <div className="grid min-h-screen place-items-center bg-g-cream px-5 text-g-word">
        <form onSubmit={(e) => { e.preventDefault(); const t = pass.trim(); if (!t) { setErr("Enter the password"); return; } try { sessionStorage.setItem("guileo_admin_tok", t); } catch { /* */ } setToken(t); setErr(""); setState("loading"); setUnlocked(true); }}
          className="w-full max-w-sm rounded-2xl border border-g-line bg-white/[0.04] p-7 text-center backdrop-blur-sm">
          <div className="text-3xl">🛡️</div>
          <div className="mt-2 text-[20px] font-black">Guileo Admin</div>
          <p className="mt-1 text-[13px] text-g-muted">Private command center.</p>
          <input type="password" value={pass} onChange={(e) => { setPass(e.target.value); setErr(""); }} placeholder="Password" autoFocus
            className="mt-5 w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-center text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
          {err && <div className="mt-2 text-[12px] text-[#e0855f]">{err}</div>}
          <button type="submit" className="mt-3 w-full rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-3 text-[14px] font-bold text-white">Enter →</button>
          <a href="/" className="mt-4 inline-block text-[12px] text-g-muted hover:text-g-word">← Back to site</a>
        </form>
      </div>
    );
  }

  const counts = rows.reduce((m, r) => { m[r.action] = (m[r.action] || 0) + 1; return m; }, {});
  const revenue = rows.filter((r) => ["sale", "order", "invoice"].includes(r.action)).reduce((s, r) => s + (parseFloat(String(r.amount).replace(/[^0-9.]/g, "")) || 0), 0);
  const top = ["lead", "book", "sale", "review", "callback", "quote"];

  // ── System health vitals (computed from data already loaded) ──
  const todayStr = new Date().toDateString();
  const eventsToday = realEvents.filter((e) => { try { return new Date(e.created_at).toDateString() === todayStr; } catch { return false; } }).length;
  const sysOnline = state === "ok"; // the token-gated RPCs returned → API + DB healthy
  const HCell = ({ ok = true, label, value }) => (
    <div className="rounded-xl border border-g-line bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-g-muted">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? "bg-g-green" : "bg-[#e0855f]"}`} />{label}
      </div>
      <div className="mt-0.5 text-[15px] font-black text-g-word">{value}</div>
    </div>
  );

  // ── Signal palette (accents only — never backgrounds) ──
  const TONE = { green: "#3E9468", orange: "#FF8A33", blue: "#5B9BD5", pink: "#E0629B", amber: "#f2b23e", red: "#e0855f" };
  // Photo-2 stat-tile: rótulo + número grande + dot de status colorido, dentro de card glassy.
  const KTile = ({ label, value, tone = "green" }) => (
    <div className="min-w-0 flex-1 rounded-xl border border-g-line bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-g-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: TONE[tone], boxShadow: `0 0 7px ${TONE[tone]}` }} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-[19px] font-black tabular-nums text-g-word">{value}</div>
    </div>
  );
  // Cabeçalho de coluna: pílula de sinal + fileira de stat-tiles (padrão da foto-2).
  const ColBanner = ({ tag, tone, tiles }) => (
    <div className="rounded-2xl border border-g-line bg-white/[0.04] p-3 backdrop-blur-sm">
      <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider"
        style={{ borderColor: `${TONE[tone]}55`, color: TONE[tone], background: `${TONE[tone]}14` }}>{tag}</div>
      <div className="flex gap-2">{tiles.map((t) => <KTile key={t.label} {...t} />)}</div>
    </div>
  );

  // ── JORNADA — one board, the whole lead lifecycle: demo → onboarding → retenção (REAL RPC) ──
  const JourneyBoard = ({ j }) => {
    const demo = j?.demo || {}, onb = j?.onboarding || {}, ret = j?.retention || {};
    const Step = ({ n, label, tone = "orange", sub }) => (
      <div className="flex-1 min-w-[120px] rounded-xl border bg-white/[0.04] p-3 text-center"
        style={{ borderColor: `${TONE[tone]}44` }}>
        <div className="text-[24px] font-black" style={{ color: TONE[tone] }}>{n ?? 0}</div>
        <div className="mt-0.5 text-[11px] font-bold text-g-word">{label}</div>
        {sub != null && <div className="text-[10.5px] text-g-muted">{sub}</div>}
      </div>
    );
    const Arrow = () => <div className="hidden self-center px-1 text-g-muted sm:block">→</div>;
    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
    return (
      <div className="mt-5 space-y-5">
        <div className="rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
          <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">🧭 Jornada do lead — demo → onboarding → retenção</div>
          <p className="mt-1 text-[12px] text-g-muted">Do primeiro clique na demo ao cliente que fica. Números reais, atualizam a cada 5s.</p>
          {!j ? (
            <div className="mt-4 text-[13px] text-g-muted">Carregando…</div>
          ) : (
            <>
              {/* STAGE 1 · DEMO */}
              <div className="mt-4 text-[11px] font-black uppercase tracking-wide text-g-muted">1 · Demo (vitrine)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Step n={demo.views} label="Views" tone="blue" />
                <Arrow />
                <Step n={demo.leads} label="Leads" tone="orange" sub={`${pct(demo.leads, demo.views)}% dos views`} />
                <Arrow />
                <Step n={demo.checkout_start} label="Checkout" tone="amber" />
                <Arrow />
                <Step n={demo.checkout_done} label="Pago" tone="green" sub={`${pct(demo.checkout_done, demo.checkout_start)}% fecha`} />
              </div>
              {/* STAGE 2 · ONBOARDING */}
              <div className="mt-5 text-[11px] font-black uppercase tracking-wide text-g-muted">2 · Onboarding (do sim ao kickoff)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Step n={onb.total} label="Na esteira" tone="blue" />
                <Arrow />
                <Step n={onb.provisioned} label="Provisionado" tone="orange" sub="Gui nasceu" />
                <Arrow />
                <Step n={onb.kickoff} label="Kickoff" tone="amber" />
                <Arrow />
                <Step n={onb.done} label="Completo" tone="green" />
              </div>
              {/* STAGE 3 · RETENÇÃO */}
              <div className="mt-5 text-[11px] font-black uppercase tracking-wide text-g-muted">3 · Retenção (base que paga)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Step n={ret.clients_total} label="Clientes" tone="blue" />
                <Arrow />
                <Step n={ret.clients_active} label="Ativos" tone="green" sub={`${pct(ret.clients_active, ret.clients_total)}%`} />
                <Arrow />
                <Step n={ret.active_30d} label="Ativos 30d" tone="orange" />
                <Arrow />
                <Step n={ret.clients_paused} label="Pausados" tone={ret.clients_paused > 0 ? "red" : "green"} />
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Cockpit tabs — pura reorganização de layout (mesmos componentes, mesmo token, mesma auth) ──
  const TABS = [
    { key: "overview", icon: "📊", label: "Visão geral" },
    { key: "jornada", icon: "🧭", label: "Jornada" },
    { key: "clientes", icon: "👥", label: "Clientes & Vendas" },
    { key: "companyos", icon: "🏢", label: "Company OS" },
    { key: "integracoes", icon: "🔌", label: "Integrações" },
    { key: "demo", icon: "🎬", label: "Demo Engine" },
    { key: "suporte", icon: "🎧", label: "Suporte & Ops" },
    { key: "qualidade", icon: "🎯", label: "Qualidade" },
  ];

  return (
    <div className="min-h-screen bg-g-cream px-5 py-8 text-g-word">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-green">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green/50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" /></span> Live
            </div>
            <h1 className="text-2xl font-black">🛡️ Guileo Admin</h1>
            <p className="text-[13px] text-g-muted">Everything Gui does, across every client — in real time.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-g-muted">↻ atualiza a cada 5s{lastSync ? ` · última ${lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span>
            <button onClick={() => { setState("loading"); setTick((t) => t + 1); }} title="Recarregar agora" className="rounded-full border border-g-green/40 px-3 py-1.5 text-[12px] font-bold text-g-green hover:bg-g-green/10">↻ Atualizar</button>
            <button onClick={() => { try { sessionStorage.removeItem("guileo_admin"); } catch {} setUnlocked(false); }} className="rounded-full border border-g-line px-3 py-1.5 text-[12px] font-bold text-g-muted hover:text-g-word">Lock</button>
          </div>
        </div>

        {/* ══ TAB BAR — reorganização em abas (antes era um scroll único de ~15 painéis) ══ */}
        <div className="sticky top-0 z-20 -mx-5 mt-6 border-b border-g-line bg-g-cream/95 px-5 py-2 backdrop-blur-sm">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition ${tab === t.key ? "border-g-gold/50 bg-white/[0.05] text-g-gold" : "border-g-line text-g-muted hover:border-g-gold/30 hover:text-g-word"}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ═════════════════════ 📊 VISÃO GERAL ═════════════════════ */}
        {tab === "overview" && (
          <div className="mt-5 space-y-5">
            <div className="grid items-start gap-5 sm:grid-cols-2">
              <ColBanner tag="🎛️ Operação · Comando" tone="orange" tiles={[
                { label: "Saúde", value: sysOnline ? "OK" : "—", tone: sysOnline ? "green" : "red" },
                { label: "Leads", value: counts.lead || 0, tone: "orange" },
                { label: "Receita", value: "$" + revenue.toLocaleString("en-US"), tone: "amber" },
              ]} />
              <ColBanner tag="🟢 Clientes ao vivo" tone="green" tiles={[
                { label: "Clientes", value: clientsState === "ok" ? clients.length : "—", tone: "blue" },
                { label: "Eventos hoje", value: eventsToday, tone: "orange" },
                { label: "Total eventos", value: realEvents.length, tone: "green" },
              ]} />
            </div>

            {/* ── SYSTEM HEALTH — one glance: is everything green? ── */}
            <div className="rounded-2xl border border-g-green/30 bg-white/[0.04] p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-bold uppercase tracking-wider text-g-green">🩺 Saúde do sistema</div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-black ${sysOnline ? "border-g-green/45 bg-g-green/10 text-g-green" : "border-[#e0855f]/45 bg-[#e0855f]/10 text-[#e0855f]"}`}>
                  <span className="relative flex h-2 w-2"><span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${sysOnline ? "bg-g-green/60" : "bg-[#e0855f]/60"}`} /><span className={`relative inline-flex h-2 w-2 rounded-full ${sysOnline ? "bg-g-green" : "bg-[#e0855f]"}`} /></span>
                  {sysOnline ? "Tudo no ar" : "Verificando…"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <HCell ok={sysOnline} label="API + banco" value={sysOnline ? "online" : "—"} />
                <HCell label="Visitas hoje" value={siteStats?.today ?? 0} />
                <HCell label="Visitas 7 dias" value={siteStats?.week ?? 0} />
                <HCell label="Eventos reais hoje" value={eventsToday} />
                <HCell label="Eventos (total)" value={realEvents.length} />
                <HCell label="Leads (total)" value={counts.lead || 0} />
              </div>
              {/* Crons são configurados no worker (não medidos aqui) — nota honesta, não métrica */}
              <div className="mt-2.5 text-[11px] text-g-muted">⏰ Crons configurados: <span className="text-g-ink">15min · diário · segunda</span></div>
            </div>

            {/* by type — resumo das ações do Gui por tipo */}
            {top.some((k) => counts[k]) && (
              <div className="flex flex-wrap gap-2">
                {top.map((k) => counts[k] ? <span key={k} className="rounded-full border border-g-line bg-white/[0.04] px-3 py-1 text-[12px] font-semibold text-g-ink">{ICON[k] || "•"} {LABEL[k] || k}: <span className="text-g-word">{counts[k]}</span></span> : null)}
              </div>
            )}

            {/* site analytics — own privacy-first beacon (no cookies, no IDs) */}
            {siteStats && (
              <div className="rounded-2xl border border-g-gold/25 bg-white/[0.04] p-5 backdrop-blur-sm">
                <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">📈 Visitas ao site</div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div><div className="text-[24px] font-black tabular-nums text-g-word">{siteStats.today ?? 0}</div><div className="text-[11px] uppercase tracking-wide text-g-muted">hoje</div></div>
                  <div><div className="text-[24px] font-black tabular-nums text-g-word">{siteStats.week ?? 0}</div><div className="text-[11px] uppercase tracking-wide text-g-muted">7 dias</div></div>
                  <div><div className="text-[24px] font-black tabular-nums text-g-word">{siteStats.total ?? 0}</div><div className="text-[11px] uppercase tracking-wide text-g-muted">total</div></div>
                </div>
                {(siteStats.top_pages?.length > 0 || siteStats.top_refs?.length > 0 || siteStats.countries?.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
                    {(siteStats.top_pages || []).map((p) => <span key={p.page} className="rounded-full border border-g-line bg-white/[0.04] px-2.5 py-1 text-g-ink">{p.page} · <b className="text-g-word">{p.n}</b></span>)}
                    {(siteStats.top_refs || []).map((r) => <span key={r.ref} className="rounded-full border border-g-gold/25 bg-g-gold/[0.06] px-2.5 py-1 text-g-gold">↗ {r.ref} · {r.n}</span>)}
                    {(siteStats.countries || []).map((c) => <span key={c.c} className="rounded-full border border-g-line bg-white/[0.04] px-2.5 py-1 text-g-ink">🌍 {c.c} · {c.n}</span>)}
                  </div>
                )}
              </div>
            )}

            {/* ── 💰 DINHEIRO & PULSO DE HOJE — o que REALMENTE importa ver primeiro.
                Tudo derivado de realEvents (já em memória — zero fetch). Pagamentos no topo. ── */}
            {(() => {
              const isToday = (e) => { try { return new Date(e.created_at).toDateString() === todayStr; } catch { return false; } };
              const todayEv = realEvents.filter(isToday);
              const money = (e) => ["sale", "payment"].includes(e.type || "") && Number(e.amount) > 0;
              const payToday = todayEv.filter(money);
              const $today = payToday.reduce((s, e) => s + Number(e.amount || 0), 0);
              const recentPays = realEvents.filter(money).slice(0, 6);
              const cnt = (t) => todayEv.filter((e) => (e.type || "") === t).length;
              return (
                <div className="rounded-2xl border border-g-green/25 bg-white/[0.04] p-4 backdrop-blur-sm">
                  <div className="mb-2.5 flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-g-green">💰 Dinheiro & pulso · hoje</div>
                  <div className="grid grid-cols-4 gap-2">
                    <KTile label="$ hoje" value={`$${$today.toLocaleString("en-US")}`} tone="green" />
                    <KTile label="Reservas" value={cnt("booking")} tone="blue" />
                    <KTile label="Leads" value={cnt("lead")} tone="orange" />
                    <KTile label="Ligações" value={cnt("call")} tone="pink" />
                  </div>
                  {recentPays.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {recentPays.map((e, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-x-2.5 rounded-xl border border-g-green/25 bg-g-green/[0.05] px-3 py-2 text-[12.5px]">
                          <span>💳</span>
                          <span className="min-w-0 flex-1 truncate font-semibold text-g-word">{e.summary}</span>
                          <span className="font-black text-g-green">+${Number(e.amount).toLocaleString("en-US")}</span>
                          <span className="w-full text-[10.5px] text-g-muted sm:w-auto">{e.client_email} · {new Date(e.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ⚠️ FALHAS (fim, mas SEMPRE vermelho vivo) — money-losing events. Só aparece se houver alguma. */}
            {(() => {
              const fails = realEvents.filter((e) => (e.type || "") === "failure");
              if (!fails.length) return null;
              return (
                <div className="rounded-2xl border border-[#e0855f]/50 bg-[#e0855f]/[0.08] p-4">
                  <div className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-[#c8623c]">
                    <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e0855f]/60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#e0855f]" /></span>
                    ⚠️ Falhas — precisam de atenção ({fails.length})
                  </div>
                  <div className="max-h-[200px] space-y-1.5 overflow-y-auto pr-1">
                    {fails.slice(0, 20).map((e, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-x-3 rounded-xl border border-[#e0855f]/30 bg-white/[0.03] px-4 py-2.5 text-[13px]">
                        <span>⚠️</span>
                        <span className="font-semibold text-g-word">{e.summary}</span>
                        <span className="ml-auto text-[11.5px] text-g-muted">{e.client_email} · {new Date(e.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 📜 FLUXO CRU DA PLATAFORMA (fim, compacto + rolável) — o feed bruto de tudo. Ruidoso de propósito;
                fica por último. Reduzido de 520px→260px a pedido do Luis (2026-07-16). */}
            <details className="group rounded-2xl border border-g-line bg-white/[0.03] p-4 backdrop-blur-sm" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[12px] font-bold uppercase tracking-wider text-g-muted">
                <span className="flex items-center gap-2">📜 Fluxo cru da plataforma <span className="text-[10px] font-normal normal-case tracking-normal text-g-muted/70">(ligações · pagamentos · reservas · mensagens — feed completo)</span></span>
                <span className="rounded-full border border-g-line bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-g-word">{realEvents.length}</span>
              </summary>
              <div className="mt-3 max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
                {realEvents.length === 0 ? (
                  <div className="grid min-h-[100px] place-items-center rounded-xl border border-dashed border-g-line px-4 text-center text-[12.5px] text-g-muted">Sem eventos ainda — nasce aqui na 1ª ligação/pagamento.</div>
                ) : realEvents.slice(0, 60).map((e, i) => {
                  const fail = (e.type || "") === "failure";
                  return (
                    <div key={i} className={`flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-xl border px-3 py-1.5 text-[12px] ${fail ? "border-[#e0855f]/40 bg-[#e0855f]/[0.07]" : "border-g-line bg-white/[0.03]"}`}>
                      <span>{{ call: "📞", booking: "📅", sale: "💳", payment: "💰", lead: "🎯", review: "⭐", message: "💬", provision: "🤖", failure: "⚠️" }[e.type] || "•"}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-g-word">{e.summary}</span>
                      {Number(e.amount) > 0 && <span className="font-black text-g-green">+${Number(e.amount).toLocaleString("en-US")}</span>}
                      <span className="w-full text-[10px] text-g-muted sm:w-auto">{e.client_email} · {new Date(e.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        )}

        {/* ═════════════════════ 🧭 JORNADA (demo → onboarding → retenção) ═════════════════════ */}
        {tab === "jornada" && <JourneyBoard j={journey} />}

        {/* ═════════════════════ 👥 CLIENTES & VENDAS ═════════════════════ */}
        {tab === "clientes" && (
          <div className="mt-5 space-y-5">
            {/* War Room — carrossel no topo + funil dos 10 primeiros */}
            <WarRoom />

            {/* Gestão de vendedores — roster no banco (mata o env var + o furo do team-code) */}
            <SellerManager token={token} />

            {/* ONBOARD A CLIENT — one form turns a paying client live (agent + number + code) */}
            <div className="rounded-2xl border border-g-gold/30 bg-white/[0.04] p-5 backdrop-blur-sm">
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">🚀 Ativar cliente novo</div>
              <p className="mt-1 text-[12.5px] text-g-muted">Preenche e ativa: o Gui cria o agente de voz do cliente (com o cérebro dele), liga o número, gera os créditos e o código de conexão — tudo de uma vez.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[["email", "Email do cliente"], ["business", "Nome do negócio"], ["industry", "Setor (ex: salão, clínica)"], ["agent_name", "Nome do atendente (vazio = Gui)"], ["review_link", "Link do Google Reviews (opcional)"], ["forward_number", "Número p/ transferir ligação (opcional)"]].map(([k, ph]) => (
                  <input key={k} value={ob[k]} onChange={(e) => setOb((o) => ({ ...o, [k]: e.target.value }))} placeholder={ph}
                    className="rounded-xl border border-g-line bg-white/[0.05] px-4 py-2.5 text-[13px] text-g-word placeholder:text-g-muted focus:border-g-gold/50 focus:outline-none" />
                ))}
                <select value={ob.lang} onChange={(e) => setOb((o) => ({ ...o, lang: e.target.value }))} className="rounded-xl border border-g-line bg-white/[0.05] px-4 py-2.5 text-[13px] text-g-word focus:border-g-gold/50 focus:outline-none">
                  <option value="pt">🇧🇷 Português</option><option value="es">🇪🇸 Español</option><option value="en">🇺🇸 English</option>
                </select>
              </div>
              <textarea value={ob.brain} onChange={(e) => setOb((o) => ({ ...o, brain: e.target.value }))} rows={3} placeholder="Cérebro do Gui: serviços, preços, regras, horário — o que ele precisa saber pra atender e vender por esse negócio."
                className="mt-2 w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-2.5 text-[13px] text-g-word placeholder:text-g-muted focus:border-g-gold/50 focus:outline-none" />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select value={ob.number_mode} onChange={(e) => setOb((o) => ({ ...o, number_mode: e.target.value }))} className="rounded-xl border border-g-line bg-white/[0.05] px-3 py-2.5 text-[13px] text-g-word focus:border-g-gold/50 focus:outline-none">
                  <option value="shared">Número: compartilhado (testar)</option>
                  <option value="existing">Número: mapear existente</option>
                  <option value="buy">Número: comprar novo (Twilio · ~$1,15/mês)</option>
                </select>
                {ob.number_mode === "existing" && <input value={ob.existing_number} onChange={(e) => setOb((o) => ({ ...o, existing_number: e.target.value }))} placeholder="+1986..." className="rounded-xl border border-g-line bg-white/[0.05] px-3 py-2.5 text-[13px] text-g-word placeholder:text-g-muted focus:outline-none" />}
                {ob.number_mode === "buy" && <input value={ob.area_code} onChange={(e) => setOb((o) => ({ ...o, area_code: e.target.value }))} placeholder="DDD/area code (ex: 305)" className="w-40 rounded-xl border border-g-line bg-white/[0.05] px-3 py-2.5 text-[13px] text-g-word placeholder:text-g-muted focus:outline-none" />}
                <button type="button" disabled={obState === "busy"} onClick={async () => {
                  if (!ob.email.includes("@") || !ob.business.trim()) { setObState("err"); setObResult({ error: "Email e nome do negócio são obrigatórios." }); return; }
                  setObState("busy"); setObResult(null);
                  try {
                    const res = await fetch("/api/onboard-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...ob, credits: Number(ob.credits) || 0 }) });
                    const d = await res.json().catch(() => ({}));
                    if (!res.ok || d.error) { setObState("err"); setObResult(d); return; }
                    setObState("done"); setObResult(d);
                  } catch { setObState("err"); setObResult({ error: "Erro de rede." }); }
                }} className="rounded-xl bg-gradient-to-r from-g-gold to-g-copper px-5 py-2.5 text-[13px] font-black text-black disabled:opacity-60">
                  {obState === "busy" ? "Ativando…" : "🚀 Ativar cliente"}
                </button>
              </div>
              {obResult && obResult.error && <div className="mt-2 text-[12px] text-[#e0855f]">{obResult.error}</div>}
              {obResult && obResult.ok && (
                <div className="mt-3 rounded-xl border border-g-gold/30 bg-g-gold/[0.07] px-4 py-3 text-[12.5px]">
                  <div className="font-bold text-g-gold">✅ {ob.business} ativado!</div>
                  <div className="mt-1.5 grid gap-1 text-g-ink">
                    {obResult.connection_code && <div>🔑 Código de conexão: <code className="font-bold text-g-green">{obResult.connection_code}</code> <button type="button" onClick={() => { try { navigator.clipboard.writeText(obResult.connection_code); } catch { /* */ } }} className="ml-1 text-g-gold underline">copiar</button> <span className="text-g-muted">(cliente cola em Portal → Settings)</span></div>}
                    {obResult.agent_id && <div>🎙️ Agente de voz: <code className="text-g-word">{obResult.agent_id}</code></div>}
                    {obResult.number && <div>📞 Número: <code className="text-g-word">{obResult.number}</code> (a IA atende ele)</div>}
                    {obResult.forwarding && (
                      <div className="mt-1.5 rounded-lg border border-g-green/25 bg-g-green/[0.06] px-3 py-2">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-g-green">📲 Entregue ao cliente — encaminhar a linha dele</div>
                        <div className="mt-1 text-[12px] text-g-ink">📞 {obResult.forwarding.full}</div>
                        <div className="mt-0.5 text-[12px] text-g-ink">🛟 {obResult.forwarding.missed}</div>
                        <div className="mt-1 text-[11px] text-g-muted">{obResult.forwarding.note}</div>
                      </div>
                    )}
                    <div className="text-g-muted">Status: {Object.entries(obResult.steps || {}).map(([k, v]) => `${k}=${v}`).join(" · ")}</div>
                    {ob.number_mode !== "shared" && <div className="mt-1 text-[11.5px] text-g-muted">⚠️ Pra SMS em escala: registre este número no A2P 10DLC (Twilio → Messaging → Regulatory). Sem isso, SMS pode ser bloqueado.</div>}
                  </div>
                </div>
              )}
            </div>

            {/* connection codes — generate/fetch the code that flips a client's portal to REAL data */}
            <div className="rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-green">🔑 Código de conexão do cliente</div>
              <p className="mt-1 text-[12.5px] text-g-muted">Digite o email do cliente → entrego o código. Ele cola em Portal → Settings → "Código de conexão" e o dashboard dele vira dados REAIS.</p>
              <form className="mt-3 flex flex-wrap gap-2" onSubmit={async (e) => {
                e.preventDefault();
                const em = keyEmail.trim().toLowerCase();
                if (!em || !em.includes("@")) { setKeyState("err"); setKeyResult(null); return; }
                setKeyState("busy");
                const { data, error } = await supabase.rpc("admin_get_client_key", { p_token: token, p_email: em });
                if (error || !data) { setKeyState("err"); setKeyResult(null); return; }
                setKeyResult({ email: em, key: data }); setKeyState("idle");
              }}>
                <input value={keyEmail} onChange={(e) => { setKeyEmail(e.target.value); setKeyState("idle"); }} placeholder="cliente@email.com" type="email"
                  className="min-w-[220px] flex-1 rounded-xl border border-g-line bg-white/[0.05] px-4 py-2.5 text-[14px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
                <button type="submit" disabled={keyState === "busy"} className="rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
                  {keyState === "busy" ? "Buscando…" : "Gerar / buscar código"}
                </button>
              </form>
              {keyState === "err" && <div className="mt-2 text-[12px] text-[#e0855f]">Email inválido ou erro — confere e tenta de novo.</div>}
              {keyResult && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-g-green/30 bg-g-green/[0.07] px-4 py-3">
                  <span className="text-[12px] text-g-ink">{keyResult.email} →</span>
                  <code className="text-[13px] font-bold tracking-wide text-g-green">{keyResult.key}</code>
                  <button type="button" onClick={() => { try { navigator.clipboard.writeText(keyResult.key); setKeyState("copied"); setTimeout(() => setKeyState("idle"), 1600); } catch { /* */ } }}
                    className="rounded-full border border-g-green/40 px-3 py-1 text-[11.5px] font-bold text-g-green hover:bg-g-green/15">
                    {keyState === "copied" ? "Copiado ✓" : "Copiar"}
                  </button>
                </div>
              )}
            </div>

            {/* Reactivation Blitz — paste a dormant list, Gui calls/texts them all, watch the money return */}
            <div className="rounded-2xl border border-g-green/30 bg-g-green/[0.05] p-5 backdrop-blur-sm">
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-green">♻️ Blitz de Reativação</div>
              <p className="mt-1 text-[12.5px] text-g-muted">Cole a lista de clientes parados (um por linha: <span className="font-mono text-g-ink">Nome, +telefone</span> ou só o telefone) e o email do cliente dono da lista. O Gui liga/manda mensagem pra todos automaticamente (respeitando opt-out). Acompanhe o dinheiro voltar aqui.</p>

              <form className="mt-3 space-y-2" onSubmit={async (e) => {
                e.preventDefault();
                const em = blitzEmail.trim().toLowerCase();
                if (!em || !em.includes("@")) { setBlitzState("err"); setBlitzMsg("Email do cliente inválido."); return; }
                const rows = blitzList.split("\n").map((line) => {
                  const t = line.trim();
                  if (!t) return null;
                  const i = t.lastIndexOf(",");
                  let name = "", phone = t;
                  if (i >= 0) { name = t.slice(0, i).trim(); phone = t.slice(i + 1).trim(); }
                  if (!phone) return null;
                  return { name, phone, channel: "sms" };
                }).filter(Boolean);
                if (rows.length === 0) { setBlitzState("err"); setBlitzMsg("Cole pelo menos um contato."); return; }
                setBlitzState("busy"); setBlitzMsg("");
                // SECURITY: the upload goes through a server endpoint so the ingest secret stays
                // server-side (never shipped in this public bundle). The admin token authorizes it.
                let uploaded = 0;
                try {
                  const res = await fetch("/api/admin-blitz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, email: em, rows }) });
                  const d = await res.json().catch(() => ({}));
                  if (!res.ok || !d.ok) { setBlitzState("err"); setBlitzMsg("Erro ao subir a lista — confere e tenta de novo."); return; }
                  uploaded = d.uploaded || rows.length;
                } catch { setBlitzState("err"); setBlitzMsg("Erro de rede — tenta de novo."); return; }
                setBlitzState("idle"); setBlitzMsg(`✓ ${uploaded} contato${uploaded === 1 ? "" : "s"} subido${uploaded === 1 ? "" : "s"} para ${em}. O Gui começa a trabalhar.`);
                setBlitzList("");
              }}>
                <input value={blitzEmail} onChange={(e) => { setBlitzEmail(e.target.value); setBlitzState("idle"); }} placeholder="cliente@email.com (dono da lista)" type="email"
                  className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-2.5 text-[14px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
                <textarea value={blitzList} onChange={(e) => { setBlitzList(e.target.value); setBlitzState("idle"); }} rows={6} placeholder={"Maria Silva, +5511999990000\nJoão Souza, +5511988887777\n+5511977776666"}
                  className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-2.5 text-[13px] font-mono text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
                <button type="submit" disabled={blitzState === "busy"} className="rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
                  {blitzState === "busy" ? "Subindo…" : "📤 Subir lista"}
                </button>
              </form>
              {blitzMsg && <div className={`mt-2 text-[12px] ${blitzState === "err" ? "text-[#e0855f]" : "text-g-green"}`}>{blitzMsg}</div>}

              {/* live stats — total / pending / contacted / replied / won */}
              <div className="mt-4 border-t border-g-green/20 pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-g-muted">Status da reativação{blitzEmail.trim() ? ` · ${blitzEmail.trim()}` : " · todos"}</div>
                  <button type="button" disabled={statsState === "busy"} onClick={async () => {
                    setStatsState("busy");
                    const { data, error } = await supabase.rpc("blitz_stats", { p_token: token, p_email: blitzEmail.trim() || "" });
                    if (error) { setStatsState("err"); return; }
                    setBlitzStats(data || null); setStatsState("idle");
                  }} className="rounded-full border border-g-green/40 px-3 py-1 text-[11.5px] font-bold text-g-green hover:bg-g-green/15 disabled:opacity-60">
                    {statsState === "busy" ? "…" : "↻ Atualizar"}
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {[["total", "total"], ["pending", "pendentes"], ["contacted", "contatados"], ["replied", "responderam"], ["won", "fecharam"]].map(([k, label]) => (
                    <div key={k} className="rounded-xl border border-g-green/25 bg-g-green/[0.06] px-2 py-2.5 text-center">
                      <div className="text-[22px] font-black tabular-nums text-g-green" style={{ textShadow: "0 0 14px rgba(34,197,94,0.45)" }}>{blitzStats ? (blitzStats[k] ?? 0) : "—"}</div>
                      <div className="text-[10px] uppercase tracking-wide text-g-muted">{label}</div>
                    </div>
                  ))}
                </div>
                {statsState === "err" && <div className="mt-2 text-[12px] text-[#e0855f]">Não consegui buscar o status — confere o token.</div>}
              </div>
            </div>

            {/* 👛 CARTEIRA DE CLIENTES — every client as an Apple-Wallet pass w/ the 4-color semaphore
                (mesma fonte do hub do vendedor: seller_wallet admin scope) */}
            <ClientWallet token={token} />

            {/* ⚡ LIVE ACTIVITY — Gui's real per-client actions (gui_actions). Subiu pro topo: é a ação REAL,
                não o feed cru. (movido de baixo pra cá a pedido do Luis 2026-07-16) */}
            <div className="rounded-2xl border border-g-orange/25 bg-white/[0.04] p-4 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-g-orange">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-orange/50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-g-orange" /></span>
                ⚡ Live activity — o que a Gui está fazendo
              </div>
              {state === "loading" && <div className="text-center text-sm text-g-muted">Loading…</div>}
              {state === "err" && <div className="rounded-xl border border-g-line bg-white/[0.04] p-4 text-sm text-g-muted">Activity store not reachable.</div>}
              {state === "ok" && rows.length === 0 && <div className="rounded-xl border border-g-line bg-white/[0.04] p-6 text-center text-sm text-g-muted">No actions yet — ask Gui to do something on a call.</div>}
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 rounded-xl border border-g-line bg-white/[0.04] p-3.5">
                    <span className="text-lg">{ICON[r.action] || "✅"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-g-word">{LABEL[r.action] || r.action}{r.name ? ` · ${r.name}` : ""}</div>
                      <div className="text-[12px] text-g-muted">{[r.business, r.slot, r.details, r.amount && `$${r.amount}`].filter(Boolean).join(" · ")}</div>
                      {r.contact && <div className="text-[11px] text-g-muted/80">{r.contact}</div>}
                      {String(r.contact || "").includes("@") && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {[["welcome", "👋 Boas-vindas"], ["proof", "📊 Prova"], ["proposal", "💼 Proposta"], ["reengage", "🔁 Re-engaja"]].map(([step, label]) => {
                            const st = sentMap[`${r.id}:${step}`];
                            return (
                              <button key={step} onClick={() => nurture(r, step)} disabled={st === "sending" || st === "ok"}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${st === "ok" ? "border-g-green/40 bg-g-green/10 text-g-green" : st === "err" ? "border-[#e0855f]/40 text-[#e0855f]" : "border-g-line bg-white/[0.04] text-g-ink hover:text-g-word hover:border-g-green/40"}`}>
                                {st === "sending" ? "…" : st === "ok" ? "✓ enviado" : st === "err" ? "✕ erro" : label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <span className="whitespace-nowrap text-[11px] text-g-muted">{timeAgo(r.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CADASTROS PENDENTES — sellers' full intakes (OnboardWizard) → 1-click approve births the agent */}
            <OnboardApprovals token={token} />

            {/* ── RUNBOOK DO CLIENTE #1 — os 7 passos do "oi" ao primeiro dinheiro (mesmo no hub /vendedor) ── */}
            <ActivationRunbook lang="pt" />

            {/* ── 🔇 SILENT CLIENTS — provisioned (agent+number) but ZERO call/booking/message for
                ≥ SILENT_DAYS. Flagged by the /api/health-monitor weekly sweep as 'ops_alert' events
                (already in realEvents via admin_all_events — no extra fetch). Max 1 alert / 7 days. ── */}
            {(() => {
              const cutoff = Date.now() - 7 * 864e5; // only this week's alerts are "current"
              const seen = new Set();
              const silent = realEvents.filter((e) => {
                if ((e.type || "") !== "ops_alert" || !String(e.summary || "").startsWith("🔇")) return false;
                try { if (new Date(e.created_at).getTime() < cutoff) return false; } catch { return false; }
                const k = (e.client_email || "").toLowerCase();
                if (!k || seen.has(k)) return false;
                seen.add(k); return true;
              });
              return (
                <div className="rounded-2xl border border-g-gold/25 bg-white/[0.04] p-4">
                  <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">🔇 Clientes silenciosos</div>
                  {silent.length === 0 ? (
                    <p className="mt-2 text-[13px] text-g-muted">Nenhum cliente silencioso 🎉</p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {silent.slice(0, 12).map((e, i) => {
                        const days = (String(e.summary || "").match(/há (\d+\+?) dias/) || [])[1] || "?";
                        const em = e.client_email || "";
                        return (
                          <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-g-gold/25 bg-g-gold/[0.05] px-4 py-2.5 text-[13px]">
                            <span>🔇</span>
                            <span className="font-semibold text-g-word">{em}</span>
                            <span className="text-[11.5px] text-g-muted">{days} dias sem ligação/agendamento/mensagem — agente quebrado? número errado? churn?</span>
                            <span className="ml-auto flex gap-1.5">
                              <a href={`mailto:${em}?subject=${encodeURIComponent("Tudo certo com a sua Gui?")}`} className="rounded-full border border-g-line bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-g-ink hover:border-g-green/40 hover:text-g-word">✉️ Email</a>
                              <a href={`https://wa.me/?text=${encodeURIComponent(`Oi! Aqui é o Luis da Guileo — vi que a Gui de ${em} está quieta há ${days} dias. Tá tudo certo por aí? Posso ajudar?`)}`} target="_blank" rel="noopener" className="rounded-full border border-g-green/35 bg-g-green/[0.08] px-2.5 py-1 text-[11px] font-semibold text-g-green hover:bg-g-green/[0.16]">💬 WhatsApp</a>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* registered clients */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-g-muted">
                Registered clients
                {clientsState === "ok" && <span className="rounded-full border border-g-line bg-white/[0.04] px-2 py-0.5 text-[11px] text-g-word">{clients.length}</span>}
              </div>
              {clientsState === "loading" && <div className="text-center text-sm text-g-muted">Loading…</div>}
              {clientsState === "err" && (
                <div className="rounded-xl border border-g-line bg-white/[0.04] p-4 text-sm text-g-muted">
                  Clients registry not available with current policies — run <span className="font-mono text-g-word">db/clients.sql</span> and add an admin-read RLS policy to list all clients.
                </div>
              )}
              {clientsState === "ok" && clients.length === 0 && (
                <div className="rounded-xl border border-g-line bg-white/[0.04] p-6 text-center text-sm text-g-muted">
                  No clients visible yet — anon reads are blocked by RLS. Add an admin-read policy (or run <span className="font-mono text-g-word">db/clients.sql</span>) to populate this list.
                </div>
              )}
              {clientsState === "ok" && clients.length > 0 && (
                <div className="space-y-2">
                  {clients.map((c) => (
                    <div key={c.uid} className="flex items-start gap-3 rounded-xl border border-g-line bg-white/[0.04] p-3.5">
                      <span className="text-lg">👤</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold text-g-word">{[c.name, c.business].filter(Boolean).join(" · ") || c.email}</div>
                        <div className="text-[12px] text-g-muted">{[c.email, c.sector, c.plan].filter(Boolean).join(" · ")}</div>
                      </div>
                      <span className="whitespace-nowrap text-[11px] text-g-muted">{timeAgo(c.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════ 🏢 COMPANY OS ═════════════════════ */}
        {tab === "companyos" && (
          <div className="mt-5 space-y-5">
            {/* ── FINANÇAS DA COMPANHIA — o razão da própria Guileo (despesas/investimentos/receita) ── */}
            <CompanyFinance token={token} />

            {/* ── COMPANY OS — os 8 departamentos da própria Guileo, KPI real de cada um ── */}
            <CompanyOS token={token} />

            {/* Stripe self-serve plans — create/sync the $149/$449/$999 Payment Links from the server (owner-only).
                You click it (so you authorize live payment setup); it returns the 3 links to wire into the site. */}
            <div className="rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">💳 Planos no Stripe ($149 / $449 / $999)</div>
              <p className="mt-1 text-[12.5px] text-g-muted">Cria/sincroniza os 3 links de pagamento (Essential $149 · Personalized $449 · Full Operation $999) com os créditos certos. Clique uma vez — depois me mande os 3 links pra eu fixar na /planos.</p>
              <button type="button" disabled={planState === "busy"} onClick={async () => {
                setPlanState("busy"); setPlanResult(null);
                try {
                  const res = await fetch("/api/setup-selfserve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
                  const d = await res.json().catch(() => ({})); // T1.4 — a 500 HTML body must not throw a generic "rede"
                  if (!res.ok || d.error || d.ok === false) { setPlanState("err"); setPlanResult(d); return; }
                  setPlanState("done"); setPlanResult(d);
                } catch { setPlanState("err"); setPlanResult({ error: "Erro de rede." }); }
              }} className="mt-3 rounded-xl bg-gradient-to-r from-g-gold to-g-copper px-5 py-2.5 text-[13px] font-black text-black disabled:opacity-60">
                {planState === "busy" ? "Criando no Stripe…" : "💳 Criar / sincronizar planos"}
              </button>
              {planState === "err" && <div className="mt-2 text-[12px] text-[#e0855f]">{planResult?.error || "Erro — confere se o STRIPE_SECRET_KEY está no Cloudflare."}</div>}
              {planState === "done" && planResult?.links && (
                <div className="mt-3 rounded-xl border border-g-gold/30 bg-g-gold/[0.07] px-4 py-3 text-[12.5px]">
                  <div className="font-bold text-g-gold">✅ Links criados — copie e me mande:</div>
                  <div className="mt-1.5 grid gap-1.5">
                    {planResult.links.map((l) => (
                      <div key={l.id} className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-g-word">{l.name} ${l.amount}:</span>
                        <code className="break-all text-g-green">{l.url}</code>
                        <button type="button" onClick={() => { try { navigator.clipboard.writeText(l.url); } catch { /* */ } }} className="text-g-gold underline">copiar</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════ 🔌 INTEGRAÇÕES ═════════════════════ */}
        {tab === "integracoes" && (
          <div className="mt-5 space-y-5">
            {/* ── ESTADO DOS CANAIS — hub honesto (lê /api/broto activations por presença real de env vars) ── */}
            <ChannelStatus token={token} />
            {/* ── CONECTAR META — dono cola o Page Access Token → liga IG/Messenger a um cliente ── */}
            <MetaConnect token={token} />
          </div>
        )}

        {/* ═════════════════════ 🎬 DEMO ENGINE ═════════════════════ */}
        {tab === "demo" && (
          <div className="mt-5 rounded-2xl bg-[#161512] p-3 text-g-ink">
            <DemoEngine surface="admin" />
          </div>
        )}

        {/* ═════════════════════ 🎧 SUPORTE & OPS ═════════════════════ */}
        {tab === "suporte" && (
          <div className="mt-5 space-y-5">
            {/* ── BROTO — internal support & ops console (tickets · inventory · health) ── */}
            <Broto token={token} />

            {/* ── ATIVAÇÃO — passo a passo pra deixar um cliente pago no ar (1 fonte: data/activation.js) ── */}
            <div className="rounded-2xl border border-g-line bg-white/[0.04] p-5">
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-green">🚀 Ativação de cliente — passo a passo</div>
              <ol className="mt-3 space-y-2">
                {ACTIVATION_STEPS.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] text-g-word"><span className="font-black text-g-green">{i + 1}.</span><span><b>{s.icon} {pickL(s.title, "pt")}</b> <span className="text-g-muted">— {pickL(s.body, "pt")}</span></span></li>
                ))}
              </ol>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {ACTIVATION_SECTORS.map((s) => (
                  <div key={s.icon} className="rounded-xl border border-g-line bg-white/[0.03] p-3"><div className="text-[12px] font-bold text-g-word">{s.icon} {pickL(s.name, "pt")}</div><div className="mt-1 text-[11.5px] leading-snug text-g-muted">{pickL(s.note, "pt")}</div></div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-g-gold/25 bg-g-gold/[0.06] p-3 text-[12px] leading-relaxed text-g-word">
                🔑 <b>Delivery (restaurante):</b> aponte o webhook do agregador pra<br />
                <code className="font-mono text-[11px] text-g-gold">guileoai.com/api/delivery-webhook?client=&lt;email-do-cliente&gt;&amp;secret=&lt;DELIVERY_WEBHOOK_SECRET&gt;</code><br />
                O segredo está no <b>Cloudflare → Env vars (DELIVERY_WEBHOOK_SECRET)</b> — não fica no código por segurança.
              </div>
            </div>

            {/* ── MANUAL DE OPERAÇÃO — como o Luis roda a Guileo no dia a dia (fechado por padrão) ── */}
            <details className="group rounded-2xl border border-g-line bg-white/[0.04] p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <span className="text-[12px] font-bold uppercase tracking-wider text-g-green">📖 Como operar a Guileo (o manual)</span>
                <span className="shrink-0 text-[12px] font-bold text-g-muted transition group-open:rotate-90">▸</span>
              </summary>
              <div className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-g-word">
                <div className="rounded-xl border border-g-line bg-white/[0.03] p-3">
                  <b>☀️ Todo dia (30–60min):</b> <span className="text-g-muted">1) Abrir o War Room acima → 3 abordagens novas (💬) · 2) Respondeu? Mandar o 🔗 link de demo NA HORA · 3) Olhar a Saúde do sistema (verde?)</span>
                </div>
                <div className="rounded-xl border border-g-line bg-white/[0.03] p-3">
                  <b>🤝 Quando fechar:</b> <span className="text-g-muted">o sistema provisiona sozinho (pagou → Gui nasce → código no email) — você só confere a ativação aqui e manda um áudio pessoal de boas-vindas</span>
                </div>
                <div className="rounded-xl border border-g-line bg-white/[0.03] p-3">
                  <b>📅 Toda segunda (15min):</b> <span className="text-g-muted">relatório semanal já foi sozinho · olhar churn/uso · pedir 1 melhoria ao Claude · publicar 1 conteúdo</span>
                </div>
                <div className="rounded-xl border border-g-line bg-white/[0.03] p-3">
                  <b>🗓️ Todo mês:</b> <span className="text-g-muted">pedir depoimento aos clientes felizes → mandar pro Claude pôr na landing · rever meta · +1 vendedor a cada 5 clientes</span>
                </div>
                <div className="rounded-xl border border-g-green/25 bg-g-green/[0.05] p-3">
                  <b>🤖 Roda sozinho (não gastar neurônio):</b> <span className="text-g-muted">atendimento, agenda, cobrança, follow-up, win-back, lembretes, avisos, relatórios, SEO, auto-provisão, suporte</span>
                </div>
                <div className="rounded-xl border border-g-gold/25 bg-g-gold/[0.06] p-3">
                  <b>🚨 Se algo quebrar:</b> <span className="text-g-muted">Saúde do sistema vermelho → abrir sessão com o Claude: “conserta X”</span>
                </div>
              </div>
            </details>
          </div>
        )}

        {/* ═════════════════════ 🎯 QUALIDADE ═════════════════════ */}
        {tab === "qualidade" && (
          <div className="mt-5 space-y-5">
            {/* ── PAINEL DE QUALIDADE — saúde REAL dos agentes (evals) + SLO + unit economics ── */}
            <QualityPanel token={token} />
          </div>
        )}

      </div>
    </div>
  );
}

function timeAgo(iso) {
  try {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "now";
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  } catch { return ""; }
}
