/* "Leads de Marketplace" tab — Yelp / Angi / Thumbtack + realtor leads (Zillow / StreetEasy)
   flowing into Guileo.
   The speed-to-lead motor: a lead lands on the marketplace → hits the tenant's personal
   ingest URL → CRM → Gui calls the LEAD back in ~60s (hardened dial gate) → owner alerted.

   HONEST split:
     LIVE    — webhook ingestion (Zapier/Make "new lead email" → POST) + Gui callback + CRM + owner alert.
     PENDING — official marketplace APIs (Yelp Leads API needs partner approval) — shown, never faked.

   Backend (parallel slice): POST /api/marketplace-leads — {action:'list'} / {action:'set_status'},
   per-tenant gated by email+token; ingestion via the same URL with the tenant's email+key.
   Registered by the Portal orchestrator (tab key 'mktleads'). */
import { useState, useEffect } from "react";
import { FaBullseye, FaLink, FaBolt, FaEnvelope, FaPlug, FaChevronDown } from "react-icons/fa6";
import { toast, requestGuiCallback } from "../lib/portalApi.js";
import { tr, Card, Empty, SectionSkeleton, relTime } from "../pages/Portal.jsx";

// ── API seam — never throws to the UI ─────────────────────────────────────────
async function api(body) {
  try {
    const r = await fetch("/api/marketplace-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Marketplace meta — signal color by brand (Yelp red, Angi orange, Thumbtack blue, Zillow
// deep-blue, StreetEasy green). `apiBadge`/`apiNote` override the generic Yelp "awaiting
// approval" copy — honesty rule: Zillow has NO official lead API without a Premier Agent
// partnership and StreetEasy has none at all; the webhook/email-forward IS the integration.
const MARKETS = {
  yelp:      { label: "Yelp",      emoji: "🔴", color: "#FF4D4D", apiPending: true },
  angi:      { label: "Angi",      emoji: "🟠", color: "#FF8A33", apiPending: false },
  thumbtack: { label: "Thumbtack", emoji: "🔵", color: "#3FB4FF", apiPending: false },
  zillow:    { label: "Zillow",    emoji: "🔷", color: "#3B6FF7", apiPending: true,
               apiBadge: () => tr("sem API oficial — exige parceria Premier Agent"),
               apiNote:  () => tr("a Zillow só abre API de leads com parceria Premier Agent — sem ela não existe integração oficial. O link acima (Zapier ou encaminhamento do e-mail de lead) já captura 100% dos leads hoje.") },
  streeteasy:{ label: "StreetEasy", emoji: "🟩", color: "#38D07C", apiPending: true,
               apiBadge: () => tr("sem API oficial de leads"),
               apiNote:  () => tr("a StreetEasy não oferece API oficial de leads — o encaminhamento do e-mail de lead (ou Zapier) acima é o caminho real e já captura 100% dos leads hoje.") },
  other:     { label: "Outro",     emoji: "🎯", color: "#9AA0A6", apiPending: false },
};
const MKT_ORDER = ["yelp", "angi", "thumbtack", "zillow", "streeteasy"];
function normMkt(s = "") {
  const t = String(s).toLowerCase();
  if (/yelp/.test(t)) return "yelp";
  if (/angi|homeadvisor/.test(t)) return "angi";
  if (/thumbtack/.test(t)) return "thumbtack";
  if (/street\s*easy/.test(t)) return "streeteasy"; // before zillow — StreetEasy is a Zillow Group brand
  if (/zillow|trulia|hotpads/.test(t)) return "zillow";
  return MARKETS[t] ? t : "other";
}

// Status pills by meaning — new = Gui orange, called = info blue, converted = done green, lost = muted.
const STATUSES = ["new", "called", "converted", "lost"];
const STATUS_META = {
  new:       { label: () => tr("Novo"),       color: "#FF8A33" },
  called:    { label: () => tr("Ligado"),     color: "#3FB4FF" },
  converted: { label: () => tr("Convertido"), color: "#3E9468" },
  lost:      { label: () => tr("Perdido"),    color: "#8A857C" },
};
const normStatus = (st = "") => {
  const t = String(st).toLowerCase();
  if (/conv|won|fech|ganho|book|agend/.test(t)) return "converted";
  if (/call|liga|contact/.test(t)) return "called";
  if (/lost|perd/.test(t)) return "lost";
  return "new";
};

// ── Sample data (demo / not-connected) — deterministic, believable ────────────
const DEMO_LEADS = [
  { id: "dm-1", source: "yelp",      name: "Carlos M.",  phone: "+1 (917) 555-0142", service: "Reparo de encanamento", status: "new",       created_at: new Date(Date.now() - 4.2e5).toISOString() },
  { id: "dm-2", source: "thumbtack", name: "Jessica T.", phone: "+1 (646) 555-0199", service: "Pintura de sala",       status: "called",    created_at: new Date(Date.now() - 5.4e6).toISOString() },
  { id: "dm-3", source: "angi",      name: "Robert K.",  phone: "+1 (305) 555-0188", service: "Instalação elétrica",   status: "converted", created_at: new Date(Date.now() - 8.6e7).toISOString() },
  { id: "dm-4", source: "yelp",      name: "Amanda P.",  phone: "",                  service: "Limpeza pós-obra",      status: "new",       created_at: new Date(Date.now() - 1.7e8).toISOString() },
  { id: "dm-5", source: "thumbtack", name: "Diego F.",   phone: "+1 (718) 555-0166", service: "Troca de piso",         status: "lost",      created_at: new Date(Date.now() - 4.3e8).toISOString() },
  { id: "dm-6", source: "zillow",    name: "Sarah L.",   phone: "+1 (212) 555-0123", service: "123 Main St, Apt 4B",   status: "new",       created_at: new Date(Date.now() - 2.1e6).toISOString() },
  { id: "dm-7", source: "streeteasy",name: "Kevin W.",   phone: "+1 (347) 555-0177", service: "55 W 25th St #11C",     status: "called",    created_at: new Date(Date.now() - 6.1e7).toISOString() },
];

function MarketplaceLeads({ V, real = null, email = "", dataKey = "" }) {
  const live = !!(real && email && dataKey);

  const [leads, setLeads] = useState(null);     // null = fetch in flight (live)
  const [err, setErr] = useState(false);
  const [openMkt, setOpenMkt] = useState(null); // which connect card is expanded
  const [statusFor, setStatusFor] = useState(null); // lead id with the status picker open
  const [redialing, setRedialing] = useState({}); // lead id → true while Gui dials (optimistic)

  useEffect(() => {
    let alive = true;
    if (!live) { setLeads(DEMO_LEADS); return () => { alive = false; }; }
    setLeads(null); setErr(false);
    api({ action: "list", email, token: dataKey }).then((d) => {
      if (!alive) return;
      if (!d) { setErr(true); setLeads([]); return; }
      setLeads(d.leads || []);
    });
    return () => { alive = false; };
  }, [live, email, dataKey]);

  // Personal ingest URL — the ONE address every marketplace recipe posts to.
  const origin = typeof window !== "undefined" ? window.location.origin : "https://guileoai.com";
  const ingestUrl = (mkt) =>
    `${origin}/api/marketplace-leads?email=${encodeURIComponent(email || "voce@exemplo.com")}&key=${encodeURIComponent(dataKey || "SEU-TOKEN")}&source=${mkt}`;

  const copyUrl = (mkt) => {
    if (!live) { toast(tr("Conecte sua conta para gerar seu link pessoal de captura.")); return; }
    try { navigator.clipboard.writeText(ingestUrl(mkt)); toast(tr("Link copiado ✓ — cole no Zapier/Make.")); }
    catch { toast(ingestUrl(mkt)); }
  };

  const setStatus = async (lead, status) => {
    setStatusFor(null);
    setLeads((ls) => (ls || []).map((x) => (x.id === lead.id ? { ...x, status } : x))); // optimistic
    if (!live) { toast(tr("Dados de exemplo — conecte sua conta para atualizar leads reais.")); return; }
    const d = await api({ action: "set_status", email, token: dataKey, id: lead.id, status });
    if (!d?.ok) toast(tr("Não consegui salvar o status — tente de novo."));
  };

  // Re-dial a lead stuck in 'new' — REAL callback through the SAME hardened /api/call gate the
  // ingest responder uses (DNC + caps + per-destination cooldown enforced THERE). requestGuiCallback
  // returns {ok} reflecting the actual dial, so we only toast "ligando agora" on a real ok:true, then
  // flip the status to 'called' (persisted) so the button disappears — no double-dial, no fake success.
  const redial = async (lead) => {
    const phone = (lead.phone || "").toString();
    if (!phone || redialing[lead.id]) return;
    if (!live) { toast(tr("Dados de exemplo — conecte sua conta para a Gui ligar de verdade.")); return; }
    setRedialing((s) => ({ ...s, [lead.id]: true }));
    const res = await requestGuiCallback(dataKey, email, { id: lead.id, phone, name: lead.name || "" });
    setRedialing((s) => { const n = { ...s }; delete n[lead.id]; return n; });
    if (res?.ok) {
      setLeads((ls) => (ls || []).map((x) => (x.id === lead.id ? { ...x, status: "called" } : x))); // reflect
      api({ action: "set_status", email, token: dataKey, id: lead.id, status: "called" }); // persist after a real dial
      toast(tr("Gui está ligando agora 📞"));
    } else {
      toast(tr("Não consegui iniciar a ligação agora (lista de não-ligar, limite ou já ligada há pouco). Tente de novo."));
    }
  };

  const rows = leads || [];

  // ── Stats (this month) — computed client-side from the list ──
  const now = new Date();
  const monthRows = rows.filter((r) => { const d = new Date(r.created_at); return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const bySrc = MKT_ORDER.map((k) => [k, monthRows.filter((r) => normMkt(r.source) === k).length]).filter(([, n]) => n);
  const pct = (n) => (monthRows.length ? Math.round((n / monthRows.length) * 100) : 0);
  const calledPct = pct(monthRows.filter((r) => normStatus(r.status) !== "new").length); // called, converted or lost = Gui reached out
  const convPct = pct(monthRows.filter((r) => normStatus(r.status) === "converted").length);

  if (live && leads === null) return <SectionSkeleton rows={5} />;

  return (
    <div className="space-y-5 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          <FaBullseye size={11} /> {tr("Leads de Marketplace")}
          {live
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("Yelp, Angi, Thumbtack, Zillow e StreetEasy — direto para o Gui")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Cada lead do marketplace entra no CRM e a Gui liga em ~60s quando chega com telefone — antes de qualquer concorrente responder.")}</p>
      </div>

      {!live && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Dados de exemplo — conecte sua conta para ver seus leads reais de marketplace.")}
        </div>
      )}

      {/* ── Stats row — this month, computed from the list ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-g-muted">{tr("Leads no mês")}</div>
          <div className="mt-1 text-xl font-black text-g-word">{monthRows.length}</div>
          <div className="mt-0.5 text-[10px] text-g-muted truncate">
            {bySrc.length ? bySrc.map(([k, n]) => `${MARKETS[k].emoji} ${n}`).join(" · ") : "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-g-muted">{tr("Ligados")}</div>
          <div className="mt-1 text-xl font-black" style={{ color: "#3FB4FF" }}>{calledPct}%</div>
          <div className="mt-0.5 text-[10px] text-g-muted">{tr("a Gui liga em ~60s")}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-g-muted">{tr("Convertidos")}</div>
          <div className="mt-1 text-xl font-black text-g-green">{convPct}%</div>
          <div className="mt-0.5 text-[10px] text-g-muted">{tr("viraram cliente")}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-g-muted">{tr("Fontes ativas")}</div>
          <div className="mt-1 text-xl font-black text-g-word">{bySrc.length}</div>
          <div className="mt-0.5 text-[10px] text-g-muted">{tr("de 5 marketplaces")}</div>
        </Card>
      </div>

      {/* ── CONNECT — per marketplace: personal ingest URL + honest 3-step recipe ── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaPlug size={11} /> {tr("Conectar marketplaces")}</span>
          <span className="text-[11px] text-g-muted hidden sm:inline">{tr("lead chega → CRM → Gui liga → você é avisado")}</span>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {MKT_ORDER.map((k, i) => {
            const m = MARKETS[k];
            const open = openMkt === k;
            return (
              <div key={k} style={{ animationDelay: `${i * 40}ms` }} className="row-in px-5 py-3">
                <button onClick={() => setOpenMkt(open ? null : k)} className="w-full flex items-center gap-3 text-left">
                  <span className="grid place-items-center h-9 w-9 rounded-full shrink-0 text-base" style={{ background: m.color + "1e" }}>{m.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{m.label}</div>
                    <div className="text-[11px] text-g-muted truncate">{tr("via Zapier/Make ou encaminhamento de e-mail")}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[9px] font-black text-g-green shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-g-green" /> {tr("webhook LIVE")}</span>
                  {m.apiPending && (
                    <span className="text-[9px] font-black text-g-gold border border-g-gold/30 rounded-full px-1.5 py-px uppercase shrink-0">{m.apiBadge ? m.apiBadge() : tr("API oficial — aguardando aprovação")}</span>
                  )}
                  <FaChevronDown size={10} className={`text-g-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>

                {open && (
                  <div className="mt-2.5 ml-12 rounded-xl2 border border-white/10 bg-white/[0.02] px-3.5 py-3 space-y-3">
                    {/* Personal ingest URL */}
                    <div>
                      <div className="text-[11px] font-bold text-g-muted mb-1">{tr("Seu link pessoal de captura")}</div>
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <code className="flex-1 min-w-0 truncate rounded-xl2 border border-white/12 bg-white/[0.04] px-3 py-2 text-[11px] text-g-word font-mono">{ingestUrl(k)}</code>
                        <button onClick={() => copyUrl(k)} className="inline-flex items-center gap-1 rounded-full border border-g-gold/35 bg-g-gold/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-gold/20 transition shrink-0"><FaLink size={9} /> {tr("Copiar")}</button>
                      </div>
                    </div>
                    {/* The 3 honest paths */}
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="grid place-items-center h-6 w-6 rounded-full bg-g-green/15 text-g-green shrink-0"><FaBolt size={9} /></span>
                        <div className="text-[11px] text-g-muted">
                          <span className="font-bold text-g-word">{tr("1. Zapier ou Make (recomendado)")}</span> — {tr('crie um gatilho "novo e-mail de lead" na sua caixa e um passo Webhook → POST para o link acima. Funciona hoje.')}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="grid place-items-center h-6 w-6 rounded-full bg-[#FFC23D]/15 shrink-0" style={{ color: "#FFC23D" }}><FaEnvelope size={9} /></span>
                        <div className="text-[11px] text-g-muted">
                          <span className="font-bold text-g-word">{tr("2. Encaminhamento de e-mail")}</span> — {tr("redirecione os e-mails de lead para um endereço de captura. Este caminho precisa de configuração do nosso time — fale com o suporte para ativar.")}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="grid place-items-center h-6 w-6 rounded-full bg-white/[0.06] text-g-muted shrink-0"><FaPlug size={9} /></span>
                        <div className="text-[11px] text-g-muted">
                          <span className="font-bold text-g-word">{tr("3. API oficial")}</span> — {m.apiNote
                            ? m.apiNote()
                            : m.apiPending
                              ? tr("a Yelp Leads API exige aprovação de parceiro — já solicitada. Liga automaticamente quando aprovar; nada muda para você.")
                              : tr("integração direta em avaliação — o webhook acima já cobre 100% dos leads hoje.")}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── LEADS list ── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaBullseye size={11} /> {tr("Leads recebidos")}</span>
          <span className="text-[11px] font-bold hidden sm:inline" style={{ color: "#FF8A33" }}>📞 {tr("a Gui liga em ~60s quando chega com telefone")}</span>
        </div>
        {live && err ? (
          <Empty icon="📡" text={tr("Não consegui carregar seus leads — verifique a conexão e atualize.")} />
        ) : rows.length === 0 ? (
          <Empty icon="🎯" text={tr("Nenhum lead de marketplace ainda — conecte um marketplace acima e eles aparecem aqui na hora.")} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {rows.map((r, i) => {
              const mk = MARKETS[normMkt(r.source)] || MARKETS.other;
              const st = normStatus(r.status);
              const meta = STATUS_META[st];
              const picking = statusFor === r.id;
              return (
                <div key={r.id || i} style={{ animationDelay: `${i * 40}ms` }} className="row-in flex items-center gap-3 px-5 py-3 flex-wrap sm:flex-nowrap">
                  <span className="grid place-items-center h-9 w-9 rounded-full shrink-0 text-base" style={{ background: mk.color + "1e" }}>{mk.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{r.name || tr("Lead")}{r.service ? <span className="text-g-muted font-normal"> · {r.service}</span> : null}</div>
                    <div className="text-[11px] text-g-muted truncate">{mk.label} · {r.phone || tr("sem telefone")}{r.created_at ? ` · ${relTime(r.created_at)}` : ""}</div>
                  </div>
                  {/* Re-dial — a lead still in 'new' WITH a phone gets the 1-click callback. In demo it
                      shows a sample toast; live routes through the hardened /api/call gate (redial() guards). */}
                  {st === "new" && r.phone && (
                    redialing[r.id] ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-g-green px-2.5 py-1 shrink-0 whitespace-nowrap">📞 {tr("Ligando…")}</span>
                    ) : (
                      <button onClick={() => redial(r)} title={tr("Gui liga este lead agora")}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black text-[#161512] shrink-0 whitespace-nowrap transition hover:opacity-90 min-h-[44px] inline-flex items-center"
                        style={{ background: "#FF8A33" }}>
                        📞 {tr("Gui liga agora")}
                      </button>
                    )
                  )}
                  {picking ? (
                    <div className="flex items-center gap-1 shrink-0 flex-wrap">
                      {STATUSES.map((s) => (
                        <button key={s} onClick={() => setStatus(r, s)}
                          className="rounded-full px-2.5 py-1 text-[10px] font-black transition hover:opacity-80 min-h-[44px] inline-flex items-center"
                          style={{ color: STATUS_META[s].color, background: `${STATUS_META[s].color}1e`, boxShadow: s === st ? `inset 0 0 0 1px ${STATUS_META[s].color}` : `inset 0 0 0 1px ${STATUS_META[s].color}40` }}>
                          {STATUS_META[s].label()}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button onClick={() => setStatusFor(r.id)} title={tr("Trocar status")}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black whitespace-nowrap shrink-0 transition hover:opacity-80 min-h-[44px] inline-flex items-center"
                      style={{ color: meta.color, background: `${meta.color}1e`, boxShadow: `inset 0 0 0 1px ${meta.color}40` }}>
                      {meta.label()} <FaChevronDown size={8} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

export default MarketplaceLeads;
