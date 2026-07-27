import { useEffect, useState, useMemo } from "react";

// BROTO — our internal support & ops console, embedded in /admin. The team behind Gui:
// the whole ticket queue across every tenant, our platform inventory (numbers / hardware /
// accounts / integrations), and a live health read. Calls /api/broto (admin-token gated).
// Light theme to match Admin.jsx (bg-g-cream).

const STATUS = [
  { k: "open", label: "Open", tone: "border-sky-400/40 bg-sky-400/10 text-sky-700" },
  { k: "resolving", label: "Resolving", tone: "border-amber-400/40 bg-amber-400/10 text-amber-700" },
  { k: "escalated", label: "Escalated", tone: "border-[#e0855f]/45 bg-[#e0855f]/10 text-[#c8623c]" },
  { k: "resolved", label: "Resolved", tone: "border-g-green/40 bg-g-green/10 text-g-green" },
];
const toneOf = (s) => (STATUS.find((x) => x.k === s) || STATUS[0]).tone;
const INV_KINDS = ["number", "hardware", "account", "integration"];

// ACTIVATION KEYS — the external money-engines, ordered by revenue impact. Display metadata only;
// the LIVE ligada/apagada state comes from /api/broto action:"activations" (reads env presence
// server-side, never the value). Mirrors ATIVACOES.md — keep the two in sync.
const ACTIV_KEYS = [
  { id: "stripe", emoji: "💳", name: "Stripe Connect", effort: "médio",
    lights: "A Gui fecha E COLETA na ligação — dinheiro na conta do próprio cliente",
    where: "Siga db/STRIPE_SETUP.md. Dashboard Stripe → Connect → Get started → Express (o cliente conecta em 1 clique). Confirme os 5 eventos de webhook.",
    proof: "client_stripe_lookup retorna acct_…; do_action invoice gera link real em vez de honestNoLink." },
  { id: "a2p", emoji: "📱", name: "A2P 10DLC (Twilio)", effort: "médio · aprovação leva dias",
    lights: "SMS destrava: survey, aviso do dono, missed-call text-back (hoje erro 30034)",
    where: "Não é env var — é registro. Twilio Console → Messaging → Regulatory Compliance → A2P 10DLC → Brand + Campaign (marca Guileo / Tribeca Global).",
    proof: "Twilio já setado — SMS liga sozinho quando a campanha aprovar; teste sai sem erro 30034." },
  { id: "whats", emoji: "💬", name: "WhatsApp + Instagram DM", effort: "médio",
    lights: "A Gui responde WhatsApp e IG DM — o canal nº1 do Brasil, mesmo cérebro do webchat",
    where: "Meta for Developers → criar App → WhatsApp + Messenger. Webhook: guileoai.com/api/meta-webhook.",
    proof: "/api/meta-webhook valida HMAC (hoje 403 sem app); com o app, um DM chega no CRM e a Gui responde." },
  { id: "gbp", emoji: "🔵", name: "Google Business", effort: "médio",
    lights: "A Gui pede review pós-visita e RESPONDE reviews no Google + SEO local",
    where: "Google Cloud Console → criar OAuth Client (Business Profile API) → autorizar o GBP do cliente.",
    proof: "/api/google-business sai de ready:false; o cron review-responder passa a responder reviews reais." },
  { id: "mindbody", emoji: "📅", name: "MindBody (agenda da Natura)", effort: "baixo · só a chave",
    lights: "A Gui agenda direto no MindBody que a Natura já usa (adapter pronto)",
    where: "MindBody Developer Portal → gerar API key da conta da Natura.",
    proof: "scheduleAdapter resolve mindbody como fonte-da-verdade; op=availability retorna horários reais." },
  { id: "voicecost", emoji: "💰", name: "Custo de voz — margem real", effort: "1 minuto",
    lights: "O custo por minuto entra no unit-economics → margem por cliente deixa de ser parcial",
    where: "Setar a var = tarifa real por minuto do ElevenLabs em centavos (ex.: 9 = US$0,09/min).",
    proof: "/api/unit-economics passa a mostrar elevenlabs em providers_wired e a margem real." },
  { id: "dunning", emoji: "⏸️", name: "Pausar o inadimplente", effort: "1 minuto",
    lights: "O grace-period sai do dry-run e PAUSA de verdade quem não paga (reversível)",
    where: "Setar a var = 1.",
    proof: "/api/dunning-sweep deixa de dizer wouldDo e passa a paused_flag:true no estágio 2 (7 dias)." },
  { id: "mp", emoji: "💚", name: "Mercado Pago (Brasil)", effort: "baixo",
    lights: "PIX / cartão no Brasil (webhook já vivo: valor ancorado, idempotência tripla, refund)",
    where: "No painel do Mercado Pago aponte a notificação pra guileoai.com/api/mercadopago-webhook.",
    proof: "/api/mercadopago-webhook sai de ready:false; pagamento de teste credita pelo mapa BRL exato." },
];
const ACTIV_VARS = {
  stripe: ["STRIPE_WEBHOOK_SECRET"], a2p: [], whats: ["META_APP_ID", "META_APP_SECRET", "META_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"],
  gbp: ["GOOGLE_BUSINESS_CLIENT_ID", "GOOGLE_BUSINESS_CLIENT_SECRET"], mindbody: ["MINDBODY_API_KEY"],
  voicecost: ["VOICE_COST_CENTS_PER_MIN"], dunning: ["DUNNING_ENFORCE"], mp: ["MP_ACCESS_TOKEN", "MP_WEBHOOK_SECRET"],
};

export default function Broto({ token }) {
  const [state, setState] = useState("loading");   // loading | ok | err
  const [tickets, setTickets] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [filter, setFilter] = useState("active");   // active | escalated | all
  const [tab, setTab] = useState("queue");          // queue | inventory
  const [busy, setBusy] = useState("");             // id being mutated
  const [nf, setNf] = useState({ kind: "number", label: "", status: "available", assigned: "" });
  const [sellers, setSellers] = useState(null);   // central seller leaderboard
  const [activ, setActiv] = useState(null);       // live activation state {engines,present,already}

  const call = (body) => fetch("/api/broto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...body }) }).then((r) => r.json());
  const loadSellers = async () => {
    try { const d = await fetch("/api/seller-stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "all", token }) }).then((r) => r.json()); setSellers(d.sellers || []); }
    catch { setSellers([]); }
  };
  const loadActiv = async () => { try { const d = await call({ action: "activations" }); setActiv(d.error ? { engines: [], present: {}, already: {} } : d); } catch { setActiv({ engines: [], present: {}, already: {} }); } };

  const load = async () => {
    try { const d = await call({ action: "data" }); if (d.error) { setState("err"); return; } setTickets(d.tickets || []); setInventory(d.inventory || []); setState("ok"); }
    catch { setState("err"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  const setStatus = async (t, status) => { setBusy(t.id); await call({ action: "ticket_set", id: t.id, status, resolution: status === "resolved" ? "Resolved by BROTO" : null }); await load(); setBusy(""); };
  const addInv = async (e) => { e.preventDefault(); if (!nf.label.trim()) return; setBusy("new"); await call({ action: "inv_upsert", kind: nf.kind, label: nf.label.trim(), status: nf.status, assigned: nf.assigned || null }); setNf({ kind: nf.kind, label: "", status: "available", assigned: "" }); await load(); setBusy(""); };
  const cycleInv = async (it) => { const next = it.status === "available" ? "assigned" : it.status === "assigned" ? "inactive" : "available"; setBusy(it.id); await call({ action: "inv_upsert", id: it.id, status: next }); await load(); setBusy(""); };

  const shown = useMemo(() => tickets.filter((t) => filter === "all" ? true : filter === "escalated" ? t.status === "escalated" : !["resolved"].includes(t.status)), [tickets, filter]);
  const health = useMemo(() => {
    const open = tickets.filter((t) => !["resolved"].includes(t.status)).length;
    const esc = tickets.filter((t) => t.status === "escalated").length;
    const aiRate = tickets.length ? Math.round((tickets.filter((t) => t.ai_handled).length / tickets.length) * 100) : 0;
    const avail = inventory.filter((i) => i.status === "available").length;
    const assigned = inventory.filter((i) => i.status === "assigned").length;
    return { open, esc, aiRate, avail, assigned, total: tickets.length };
  }, [tickets, inventory]);

  const Pill = ({ s }) => <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${toneOf(s)}`}>{s}</span>;

  return (
    <div className="mt-6 rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-wider text-g-green">🌱 BROTO · suporte & operações</div>
          <p className="text-[12px] text-g-muted">A equipe por trás do Gui — fila de tickets, estoque e saúde, tudo num lugar.</p>
        </div>
        <button onClick={load} className="rounded-full border border-g-line px-3 py-1.5 text-[12px] font-bold text-g-muted hover:text-g-word">↻ Atualizar</button>
      </div>

      {/* health row */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[["Tickets abertos", health.open, health.esc > 0], ["Escalados", health.esc, health.esc === 0], ["Resolvido por Gui", health.aiRate + "%", true], ["Números livres", health.avail, true], ["Em uso", health.assigned, true]].map(([label, val, ok], i) => (
          <div key={i} className="rounded-xl border border-g-line bg-white/[0.03] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-g-muted"><span className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? "bg-g-green" : "bg-[#e0855f]"}`} />{label}</div>
            <div className="mt-0.5 text-[16px] font-black text-g-word">{val}</div>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div className="mt-4 flex gap-1.5">
        {[["queue", "Fila de tickets"], ["inventory", "Estoque"], ["vendedores", "Vendedores"], ["ativacoes", "🔑 Ativações"]].map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); if (k === "vendedores" && sellers === null) loadSellers(); if (k === "ativacoes" && activ === null) loadActiv(); }} className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${tab === k ? "bg-g-green/15 border border-g-green/40 text-g-green" : "border border-g-line text-g-muted hover:text-g-word"}`}>{label}</button>
        ))}
      </div>

      {state === "loading" && <div className="mt-4 text-[13px] text-g-muted">Carregando…</div>}
      {state === "err" && <div className="mt-4 text-[13px] text-[#c8623c]">Não consegui carregar — confira o token de admin ou se o db/support.sql foi aplicado.</div>}

      {state === "ok" && tab === "queue" && (
        <div className="mt-4">
          <div className="flex gap-1.5 mb-3">
            {[["active", "Ativos"], ["escalated", "Escalados"], ["all", "Todos"]].map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${filter === k ? "bg-g-word/10 border border-g-line text-g-word" : "border border-transparent text-g-muted hover:text-g-word"}`}>{label}</button>
            ))}
          </div>
          {shown.length === 0 ? <div className="text-[13px] text-g-muted py-6 text-center">Fila limpa ✅ — nenhum ticket {filter === "escalated" ? "escalado" : "ativo"}.</div>
            : <div className="space-y-2">{shown.map((t) => (
              <div key={t.id} className="rounded-xl border border-g-line bg-white/[0.03] px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><div className="text-[13.5px] font-bold text-g-word truncate">{t.subject || "Pedido de suporte"}</div><Pill s={t.status} /></div>
                    <div className="text-[11px] text-g-muted mt-0.5">{t.client_email} · {t.category}{t.ai_handled ? " · resolvido pelo Gui" : ""}{t.priority === "urgent" ? " · 🔴 urgente" : ""}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {t.status !== "resolved" && <button disabled={busy === t.id} onClick={() => setStatus(t, "resolved")} className="rounded-full border border-g-green/40 bg-g-green/10 px-2.5 py-1 text-[11px] font-bold text-g-green hover:bg-g-green/20 disabled:opacity-50">✓ Resolver</button>}
                    {t.status !== "escalated" && <button disabled={busy === t.id} onClick={() => setStatus(t, "escalated")} className="rounded-full border border-[#e0855f]/40 bg-[#e0855f]/10 px-2.5 py-1 text-[11px] font-bold text-[#c8623c] hover:bg-[#e0855f]/20 disabled:opacity-50">↑ Escalar</button>}
                  </div>
                </div>
              </div>
            ))}</div>}
        </div>
      )}

      {state === "ok" && tab === "inventory" && (
        <div className="mt-4">
          <form onSubmit={addInv} className="flex flex-wrap items-end gap-2 mb-4 rounded-xl border border-g-line bg-white/[0.03] p-3">
            <label className="text-[11px] font-bold text-g-muted">Tipo<select value={nf.kind} onChange={(e) => setNf({ ...nf, kind: e.target.value })} className="mt-1 block rounded-lg border border-g-line bg-white/[0.05] px-2 py-1.5 text-[12px] text-g-word">{INV_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
            <label className="text-[11px] font-bold text-g-muted flex-1 min-w-[160px]">Identificação<input value={nf.label} onChange={(e) => setNf({ ...nf, label: e.target.value })} placeholder="+1 555… / iPad / Twilio acct" className="mt-1 block w-full rounded-lg border border-g-line bg-white/[0.05] px-2.5 py-1.5 text-[12px] text-g-word placeholder:text-g-muted" /></label>
            <label className="text-[11px] font-bold text-g-muted">Status<select value={nf.status} onChange={(e) => setNf({ ...nf, status: e.target.value })} className="mt-1 block rounded-lg border border-g-line bg-white/[0.05] px-2 py-1.5 text-[12px] text-g-word"><option value="available">available</option><option value="assigned">assigned</option><option value="inactive">inactive</option></select></label>
            <label className="text-[11px] font-bold text-g-muted">Cliente<input value={nf.assigned} onChange={(e) => setNf({ ...nf, assigned: e.target.value })} placeholder="email (opcional)" className="mt-1 block rounded-lg border border-g-line bg-white/[0.05] px-2.5 py-1.5 text-[12px] text-g-word placeholder:text-g-muted" /></label>
            <button disabled={busy === "new"} className="rounded-lg bg-gradient-to-r from-g-green to-g-dark px-3.5 py-2 text-[12px] font-bold text-white disabled:opacity-50">+ Adicionar</button>
          </form>
          {inventory.length === 0 ? <div className="text-[13px] text-g-muted py-6 text-center">Sem itens ainda — adicione números, hardware ou contas acima.</div>
            : INV_KINDS.filter((k) => inventory.some((i) => i.kind === k)).map((k) => (
              <div key={k} className="mb-3">
                <div className="text-[10px] font-black uppercase tracking-wider text-g-muted/70 mb-1.5">{k}</div>
                <div className="space-y-1.5">{inventory.filter((i) => i.kind === k).map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-xl border border-g-line bg-white/[0.03] px-4 py-2.5">
                    <div className="flex-1 min-w-0"><div className="text-[13px] font-bold text-g-word truncate">{it.label}</div>{it.assigned_to && <div className="text-[11px] text-g-muted">→ {it.assigned_to}</div>}</div>
                    <button disabled={busy === it.id} onClick={() => cycleInv(it)} className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide disabled:opacity-50 ${it.status === "available" ? "border-g-green/40 bg-g-green/10 text-g-green" : it.status === "assigned" ? "border-sky-400/40 bg-sky-400/10 text-sky-700" : "border-g-line bg-white/[0.04] text-g-muted"}`}>{it.status}</button>
                  </div>
                ))}</div>
              </div>
            ))}
        </div>
      )}

      {tab === "vendedores" && (
        <div className="mt-4">
          {sellers === null ? <div className="text-[13px] text-g-muted">Carregando…</div>
            : sellers.length === 0 ? <div className="text-[13px] text-g-muted py-6 text-center">Nenhum vendedor ativo ainda — eles aparecem aqui assim que entram no Hub (/vendedor).</div>
            : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1.4fr_repeat(5,0.62fr)] gap-2 px-3 text-[10px] font-black uppercase tracking-wide text-g-muted/70">
                  <span>Vendedor</span><span className="text-center">Acessos</span><span className="text-center">Orçam.</span><span className="text-center">Pitches</span><span className="text-center">Leads</span><span className="text-center">Demos·Fechou</span>
                </div>
                {sellers.slice().sort((a, b) => (b.attributedLeads || 0) - (a.attributedLeads || 0) || (b.act?.logins || 0) - (a.act?.logins || 0)).map((s) => (
                  <div key={s.email} className="grid grid-cols-[1.4fr_repeat(5,0.62fr)] items-center gap-2 rounded-xl border border-g-line bg-white/[0.03] px-3 py-2.5">
                    <div className="min-w-0"><div className="text-[13px] font-bold text-g-word truncate">{s.name}</div><div className="text-[11px] text-g-muted truncate">{s.email}</div></div>
                    <div className="text-center text-[14px] font-black text-g-word">{s.act?.logins || 0}</div>
                    <div className="text-center text-[14px] font-black text-g-word">{s.act?.quotes || 0}</div>
                    <div className="text-center text-[14px] font-black text-g-word">{s.act?.pitches || 0}</div>
                    <div className="text-center text-[15px] font-black text-g-green">{s.attributedLeads != null ? s.attributedLeads : "—"}</div>
                    <div className="text-center text-[12px] font-bold text-g-gold">{s.goals ? `${s.goals.doneDemos || 0}/${s.goals.demos || 0} · ${s.goals.doneDeals || 0}/${s.goals.deals || 0}` : "—"}</div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {tab === "ativacoes" && (
        <div className="mt-4">
          {activ === null ? <div className="text-[13px] text-g-muted">Lendo estado das chaves…</div> : (() => {
            const byId = Object.fromEntries((activ.engines || []).map((e) => [e.id, e]));
            const auto = ACTIV_KEYS.filter((k) => byId[k.id]?.detect);
            const onCount = auto.filter((k) => byId[k.id]?.ready).length;
            const pct = auto.length ? Math.round((onCount / auto.length) * 100) : 0;
            const statusOf = (k) => {
              const e = byId[k.id]; if (!e) return { t: "?", tone: "border-g-line bg-white/40 text-g-muted" };
              if (!e.detect) return { t: "verificar no provedor", tone: "border-sky-400/40 bg-sky-400/10 text-sky-700" };
              if (e.ready) return { t: "ligada", tone: "border-g-green/45 bg-g-green/10 text-g-green" };
              const vars = ACTIV_VARS[k.id] || []; const some = vars.some((v) => activ.present?.[v]);
              return some ? { t: "parcial", tone: "border-amber-400/45 bg-amber-400/10 text-amber-700" }
                          : { t: "apagada", tone: "border-[#e0855f]/45 bg-[#e0855f]/10 text-[#c8623c]" };
            };
            return (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-g-line bg-white/[0.03] px-4 py-3 mb-3">
                  <div className="text-[22px] font-black tabular-nums text-g-word">{onCount}<span className="text-[13px] text-g-muted font-bold">/{auto.length}</span></div>
                  <div className="flex-1 min-w-[120px]"><div className="h-2 rounded-full bg-g-line/60 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold transition-all" style={{ width: pct + "%" }} /></div>
                    <div className="mt-1 text-[11px] text-g-muted">chaves auto-detectáveis ligadas · a #1 (Stripe Connect) é a que faz a Gui coletar dinheiro de verdade</div></div>
                  <button onClick={loadActiv} className="shrink-0 rounded-full border border-g-line px-2.5 py-1 text-[11px] font-bold text-g-muted hover:text-g-word">↻</button>
                </div>
                <div className="space-y-2">
                  {ACTIV_KEYS.map((k, i) => {
                    const st = statusOf(k); const vars = ACTIV_VARS[k.id] || [];
                    return (
                      <details key={k.id} className="group rounded-xl border border-g-line bg-white/[0.03] overflow-hidden">
                        <summary className="flex items-start gap-3 px-4 py-3 cursor-pointer list-none">
                          <span className="shrink-0 grid h-6 w-6 place-items-center rounded-md bg-g-green/10 text-[12px] font-black text-g-green border border-g-green/30">{i + 1}</span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2 flex-wrap"><span className="text-[13.5px] font-bold text-g-word">{k.emoji} {k.name}</span>
                              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${st.tone}`}>{st.t}</span></span>
                            <span className="block text-[11.5px] text-g-muted mt-0.5">{k.lights}</span>
                          </span>
                          <span className="shrink-0 text-[10px] text-g-muted/70 pt-1">{k.effort}</span>
                        </summary>
                        <div className="px-4 pb-3.5 pl-[52px] space-y-2.5">
                          <div><div className="text-[10px] font-black uppercase tracking-wide text-g-muted/70 mb-0.5">Onde clicar</div><div className="text-[12.5px] text-g-word">{k.where}</div></div>
                          <div><div className="text-[10px] font-black uppercase tracking-wide text-g-muted/70 mb-1">{vars.length ? "Env var" + (vars.length > 1 ? "s" : "") + " no Cloudflare" : "Env var"}</div>
                            {vars.length ? <div className="flex flex-wrap gap-1.5">{vars.map((v) => (
                              <button key={v} onClick={(e) => { e.preventDefault(); try { navigator.clipboard.writeText(v); } catch { } }} title="copiar nome" className={`font-mono text-[11.5px] rounded-md border px-2 py-0.5 ${activ.present?.[v] ? "border-g-green/40 bg-g-green/10 text-g-green" : "border-g-line bg-white/40 text-g-muted"}`}>{activ.present?.[v] ? "✓ " : "○ "}{v}</button>
                            ))}</div> : <div className="text-[12px] text-g-muted">nenhuma — é registro/clique no provedor</div>}</div>
                          <div className="rounded-lg border border-sky-400/25 bg-sky-400/[0.06] px-3 py-2 text-[12px] text-g-muted"><b className="text-sky-700 font-bold">Prova:</b> {k.proof}</div>
                        </div>
                      </details>
                    );
                  })}
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {Object.entries(activ.already || {}).map(([k, on]) => (
                    <div key={k} className="flex items-center gap-1.5 rounded-lg border border-g-line bg-white/[0.03] px-2.5 py-1.5 text-[11px]"><span className={on ? "text-g-green" : "text-[#c8623c]"}>{on ? "✓" : "○"}</span><span className="font-mono text-g-muted truncate">{k}</span></div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-g-muted/80">Estado lido do ambiente em tempo real — só presença, nunca o valor. Setou uma chave? Faça um redeploy e clique ↻.</p>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
