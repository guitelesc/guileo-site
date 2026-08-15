import { useEffect, useState } from "react";

// ── GESTÃO DE VENDEDORES (admin) — the central roster panel. Data = db/seller_roster.sql through
//    POST /api/seller-admin {action:'list'|'upsert'|'disable', token}. Each seller carries a personal
//    GUI-XXXX-9999 code minted by the DB; entering with it = roster:true (full connection_code in the
//    wallet). Cement style + signal palette (Gui laranja #FF8A33, done verde #3E9468). Adding a seller
//    reveals the fresh code ONCE with 📋 copy + a wa.me welcome. Toggle activate/deactivate inline.
const OK = "#3E9468", GUI = "#FF8A33", OFF = "#e0855f", INFO = "#5B9BD5", AMBER = "#FFC23D";
const VENDEDOR_URL = "https://guileoai.com/vendedor";
// pipeline stages (drafts by status) — the wallet carries onboard_drafts.status. Unknown statuses
// fall through to the "outros" bucket so the count never lies.
const PIPE = [
  { key: "draft",    emoji: "🌱", label: "draft",    color: AMBER },
  { key: "approved", emoji: "✅", label: "aprovado", color: OK, alias: ["aprovado", "provisioned"] },
  { key: "nascendo", emoji: "🤖", label: "nascendo", color: INFO, alias: ["provisioning", "nascendo", "pending"] },
  { key: "live",     emoji: "🟢", label: "live",     color: OK },
];
const stageOf = (status) => {
  const s = (status || "").toString().toLowerCase();
  const hit = PIPE.find((p) => p.key === s || (p.alias || []).includes(s));
  return hit ? hit.key : "outros";
};

// Moeda SEMPRE explícita neste painel (2026-08-12). Ver a nota longa em SellerDashboard.jsx: o
// valor é USD de verdade e NÃO se converte; o que estava faltando era dizer isso. Aqui o público é
// o dono e o admin — quem decide quanto pagar a quem — então a ambiguidade custa ainda mais caro.
const usd = (n) => `US$ ${(Number(n) || 0).toLocaleString("en-US")}`;

export default function SellerManager({ token }) {
  const [rows, setRows] = useState(null); // null=loading, []=empty
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", email: "", commission_pct: "10" });
  const [busy, setBusy] = useState(false);
  const [justAdded, setJustAdded] = useState(null); // { name, email, ref, personal_code } — revealed once
  const [invited, setInvited] = useState({});       // email → "" | "sending" | "sent" | "err"
  const [copied, setCopied] = useState("");
  // SELLER WALLET — click a seller row to pull their pass open: the owner's accounts-payable
  // (refund-net commission ledger, same verified RPC the seller's own hub reads) + THEIR clients.
  const [open, setOpen] = useState(null);        // seller email whose pass is open
  const [passes, setPasses] = useState({});      // email → { loading } | { ledger, wallet } | { err }
  // TEAM RANKING — the whole roster ranked by refund-net commission (💰). Same verified money
  // RPCs as the individual hub, aggregated server-side (action=leaderboard). null=loading.
  const [board, setBoard] = useState(null);
  // 🚀 Lead Boss activity — per-seller worked/closed on the seeded prospect bench (/api/seller-leads all).
  const [leadBoard, setLeadBoard] = useState(null);
  // ⚙️ Platform motor stats — email suppression/campaigns + client/seller lead activity (this session's motors).
  const [motors, setMotors] = useState(null);
  // PAYOUTS — the owner's manual "repasse pago" ledger per seller (POST /api/seller-payouts).
  const [pays, setPays] = useState({});          // email → { loading } | { payouts, balance } | { err }
  const [payForm, setPayForm] = useState({});    // email → { amount, note }
  const [armed, setArmed] = useState(null);      // email whose payout is ARMED (2nd click confirms — money is never 1-click)
  const [paying, setPaying] = useState(false);

  const loadPayouts = async (email) => {
    setPays((p) => ({ ...p, [email]: { loading: true } }));
    try {
      const r = await fetch("/api/seller-payouts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", token, seller_email: email }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) { setPays((p) => ({ ...p, [email]: { err: d.error || "falha" } })); return; }
      setPays((p) => ({ ...p, [email]: { payouts: Array.isArray(d.payouts) ? d.payouts : [], balance: d.balance || null } }));
      // pre-fill the amount with the amount DUE (cents → dollars), only if the owner hasn't typed one
      const due = Number(d.balance?.due_cents || 0);
      setPayForm((f) => (f[email]?.amount != null ? f : { ...f, [email]: { amount: due > 0 ? (due / 100).toFixed(2) : "", note: "" } }));
    } catch { setPays((p) => ({ ...p, [email]: { err: "erro de rede" } })); }
  };

  const openPass = async (email) => {
    if (open === email) { setOpen(null); setArmed(null); return; }
    setOpen(email); setArmed(null);
    // payouts refresh every open (money view must be fresh); ledger/wallet cache
    loadPayouts(email);
    if (passes[email] && !passes[email].err) return; // cached
    setPasses((p) => ({ ...p, [email]: { loading: true } }));
    try {
      const r = await fetch("/api/seller-admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ledger", token, email }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) setPasses((p) => ({ ...p, [email]: { err: d.error || "falha" } }));
      else setPasses((p) => ({ ...p, [email]: { ledger: d.ledger, wallet: d.wallet } }));
    } catch { setPasses((p) => ({ ...p, [email]: { err: "erro de rede" } })); }
  };

  // Record a payout — the SECOND click of the 2-click confirm lands here (armed === email already).
  const recordPayout = async (s) => {
    const email = s.email;
    const dollars = parseFloat((payForm[email]?.amount || "").toString().replace(",", "."));
    const cents = Math.round((dollars || 0) * 100);
    if (!cents || cents <= 0) { setArmed(null); return; }
    setPaying(true);
    try {
      const period = new Date().toISOString().slice(0, 7); // YYYY-MM
      const r = await fetch("/api/seller-payouts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record", token, seller_email: email, amount_cents: cents, note: (payForm[email]?.note || "").toString().slice(0, 200), period, dedupe_key: (payForm[email]?.key || "").toString() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) { setPays((p) => ({ ...p, [email]: { ...(p[email] || {}), err: d.error || "falha ao registrar" } })); }
      else if (d.duplicate) { setPays((p) => ({ ...p, [email]: { ...(p[email] || {}), err: "⚠️ Repasse IDÊNTICO já registrado — nada foi lançado de novo. Se for um repasse novo de mesmo valor, mude a nota/período." } })); await loadPayouts(email); }
      else { setPayForm((f) => ({ ...f, [email]: { amount: "", note: "" } })); await loadPayouts(email); }
    } catch { setPays((p) => ({ ...p, [email]: { ...(p[email] || {}), err: "erro de rede" } })); }
    setArmed(null); setPaying(false);
  };

  const load = async () => {
    setErr("");
    try {
      const r = await fetch("/api/seller-admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", token }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) { setErr(d.error || "falha ao carregar"); setRows([]); return; }
      setRows(Array.isArray(d.rows) ? d.rows : []);
    } catch { setErr("erro de rede"); setRows([]); }
  };
  const loadBoard = async () => {
    setBoard(null);
    try {
      const r = await fetch("/api/seller-admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leaderboard", token }),
      });
      const d = await r.json().catch(() => ({}));
      setBoard(Array.isArray(d.board) ? d.board : []);
    } catch { setBoard([]); }
  };
  const loadLeadBoard = async () => {
    setLeadBoard(null);
    try {
      const r = await fetch("/api/seller-leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "all", token }),
      });
      const d = await r.json().catch(() => ({}));
      setLeadBoard(Array.isArray(d.rows) ? d.rows : []);
    } catch { setLeadBoard([]); }
  };
  const loadMotors = async () => {
    setMotors(null);
    try {
      const r = await fetch("/api/seller-leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "motors", token }),
      });
      const d = await r.json().catch(() => ({}));
      setMotors(d && d.ok && d.stats ? d.stats : {});
    } catch { setMotors({}); }
  };
  useEffect(() => { if (token) { load(); loadBoard(); loadLeadBoard(); loadMotors(); } /* eslint-disable-next-line */ }, [token]);

  const copy = (txt, tag) => { try { navigator.clipboard?.writeText(txt); setCopied(tag); setTimeout(() => setCopied(""), 1600); } catch { /* */ } };
  const welcomeText = (s) =>
    `Bem-vindo(a) ao time Guileo, ${s.name || s.email.split("@")[0]}! 🚀\n\n` +
    `Seu código pessoal de acesso: ${s.personal_code}\n` +
    `Entre em ${VENDEDOR_URL} com o seu email (${s.email}) e esse código.\n\n` +
    `Bora vender crescimento. 🌱`;
  const waLink = (s) => `https://wa.me/?text=${encodeURIComponent(welcomeText(s))}`;

  const add = async () => {
    const email = form.email.trim().toLowerCase();
    if (!email.includes("@")) { setErr("email inválido"); return; }
    setBusy(true); setErr(""); setJustAdded(null);
    try {
      const r = await fetch("/api/seller-admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", token, name: form.name.trim(), email, commission_pct: Number(form.commission_pct) || 10 }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error || !d.seller) { setErr(d.error || "falha ao adicionar"); setBusy(false); return; }
      setJustAdded(d.seller); // reveal the freshly-minted code ONCE
      setForm({ name: "", email: "", commission_pct: "10" });
      await load();
    } catch { setErr("erro de rede"); }
    setBusy(false);
  };

  // Email a seller their access (login link + personal code) — the code is looked up + injected
  // server-side by /api/seller-admin action:"invite"; the browser never handles the credential.
  const invite = async (s, lang) => {
    setInvited((m) => ({ ...m, [s.email]: "sending" }));
    try {
      const r = await fetch("/api/seller-admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", token, email: s.email, lang }),
      });
      const d = await r.json().catch(() => ({}));
      setInvited((m) => ({ ...m, [s.email]: r.ok && d.ok ? "sent" : "err" }));
      setTimeout(() => setInvited((m) => ({ ...m, [s.email]: "" })), 3200);
    } catch { setInvited((m) => ({ ...m, [s.email]: "err" })); }
  };
  const toggle = async (s) => {
    const active = !s.active;
    setRows((rs) => rs.map((x) => x.email === s.email ? { ...x, active } : x)); // optimistic
    try {
      const r = await fetch("/api/seller-admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", token, email: s.email, active }),
      });
      if (!r.ok) await load();
    } catch { await load(); }
  };

  const CodePill = ({ code, tag }) => (
    <button onClick={() => copy(code, tag)} title="copiar código"
      className="inline-flex items-center gap-1 rounded-lg border border-g-line bg-white/[0.05] px-2 py-0.5 font-mono text-[11px] font-bold text-g-word hover:border-g-green/40">
      {code} <span className="text-g-muted">{copied === tag ? "✓" : "📋"}</span>
    </button>
  );

  return (
    <div className="rounded-2xl border border-g-line bg-white/[0.04] p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-g-word">
          🤝 Vendedores
          {Array.isArray(rows) && <span className="rounded-full border border-g-line bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-g-word">{rows.length}</span>}
        </div>
        <button onClick={() => { setRows(null); load(); loadBoard(); loadLeadBoard(); loadMotors(); }} className="rounded-full border border-g-line bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-g-ink hover:border-g-green/40 hover:text-g-word">↻</button>
      </div>
      <p className="mt-1 text-[11.5px] text-g-muted">Cada vendedor tem um código pessoal. Quem entra com ele vê a chave completa dos clientes que assinou.</p>

      {/* ── 🏆 RANKING DO TIME — ordenado por comissão (refund-net); 1º leva a coroa ── */}
      {board === null && <div className="mt-3 h-24 animate-pulse rounded-xl border border-g-line bg-white/[0.03]" />}
      {Array.isArray(board) && board.length > 0 && (
        <div className="mt-3 rounded-xl border border-g-gold/25 bg-g-gold/[0.04] p-3">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide" style={{ color: GUI }}>🏆 Ranking do time</div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[12px]">
              <thead>
                <tr className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">
                  <th className="px-1.5 py-1 text-left">#</th>
                  <th className="px-1.5 py-1 text-left">Vendedor</th>
                  <th className="px-1.5 py-1 text-right">Carteira</th>
                  <th className="px-1.5 py-1 text-right">Pagantes</th>
                  <th className="px-1.5 py-1 text-right">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {board.map((v, i) => (
                  <tr key={v.email} className={`border-t border-g-line ${i === 0 ? "bg-g-gold/[0.06]" : ""}`}>
                    <td className="px-1.5 py-1.5 font-black" style={{ color: i === 0 ? GUI : undefined }}>{i === 0 ? "👑" : i + 1}</td>
                    <td className="px-1.5 py-1.5 font-bold text-g-word">
                      {v.name}
                      {v.converted_month > 0 && <span className="ml-1.5 text-[9.5px] font-semibold" style={{ color: OK }}>+{v.converted_month} mês</span>}
                    </td>
                    <td className="px-1.5 py-1.5 text-right text-g-ink">{v.wallet}</td>
                    <td className="px-1.5 py-1.5 text-right text-g-ink">{v.paying}</td>
                    <td className="px-1.5 py-1.5 text-right font-black" style={{ color: i === 0 ? GUI : OK }}>{usd(v.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ⚙️ MOTORES (plataforma) — visão dos sistemas deste ciclo ── */}
      {motors && Object.keys(motors).length > 0 && (
        <div className="mt-3 rounded-xl border border-g-line bg-white/[0.03] p-3">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-g-word">⚙️ Motores · plataforma</div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              ["📇 Vendedores c/ leads", motors.sellers_working_leads, "fechados", motors.seller_leads_closed],
              ["👤 Clientes c/ leads", motors.clients_working_leads, "trabalhados", motors.client_leads_worked],
              ["🏆 Leads fechados (cliente)", motors.client_leads_closed],
              ["📧 Campanhas enviadas", motors.campaigns_sent, "e-mails", motors.campaign_emails],
              ["🚫 Descadastros", motors.suppressions],
            ].map(([label, val, sub, subval], i) => (
              <div key={i} className="rounded-lg border border-g-line bg-white/[0.02] p-2.5">
                <div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted leading-tight">{label}</div>
                <div className="mt-1 text-lg font-black text-g-word tabular-nums">{Number(val || 0).toLocaleString("pt-BR")}</div>
                {sub != null && <div className="text-[10px] text-g-muted">{Number(subval || 0).toLocaleString("pt-BR")} {sub}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 🚀 LEAD BOSS — atividade dos vendedores no bench de leads semeados ── */}
      {Array.isArray(leadBoard) && leadBoard.length > 0 && (
        <div className="mt-3 rounded-xl border border-g-green/25 bg-g-green/[0.04] p-3">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-g-green">🚀 Lead Boss — atividade</div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[12px]">
              <thead>
                <tr className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">
                  <th className="px-1.5 py-1 text-left">Vendedor</th>
                  <th className="px-1.5 py-1 text-right">Trabalhados</th>
                  <th className="px-1.5 py-1 text-right">Fechados</th>
                  <th className="px-1.5 py-1 text-right">Última ação</th>
                </tr>
              </thead>
              <tbody>
                {leadBoard.map((v) => (
                  <tr key={v.seller_email} className="border-t border-g-line">
                    <td className="px-1.5 py-1.5 font-bold text-g-word">{v.seller_email}</td>
                    <td className="px-1.5 py-1.5 text-right text-g-ink">{v.worked}/{v.leads}</td>
                    <td className="px-1.5 py-1.5 text-right font-black" style={{ color: OK }}>{v.closed}</td>
                    <td className="px-1.5 py-1.5 text-right text-g-muted">{v.last_activity ? new Date(v.last_activity).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FORM: adicionar vendedor ── */}
      <div className="mt-3 rounded-xl border border-g-gold/25 bg-g-gold/[0.05] p-3">
        <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: GUI }}>＋ Adicionar vendedor</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome"
            className="min-w-[120px] flex-1 rounded-lg border border-g-line bg-white/[0.05] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted focus:border-g-gold/50 focus:outline-none" />
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" type="email"
            className="min-w-[160px] flex-1 rounded-lg border border-g-line bg-white/[0.05] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted focus:border-g-gold/50 focus:outline-none" />
          <div className="flex items-center gap-1 rounded-lg border border-g-line bg-white/[0.05] px-2">
            <input value={form.commission_pct} onChange={(e) => setForm((f) => ({ ...f, commission_pct: e.target.value.replace(/[^0-9]/g, "").slice(0, 3) }))} placeholder="10"
              className="w-10 bg-transparent py-2 text-center text-[13px] text-g-word focus:outline-none" />
            <span className="text-[12px] text-g-muted">% comissão</span>
          </div>
          <button onClick={add} disabled={busy}
            className="rounded-lg bg-gradient-to-r from-g-gold to-g-copper px-4 py-2 text-[13px] font-black text-black disabled:opacity-60">
            {busy ? "…" : "Adicionar"}
          </button>
        </div>
        {err && <div className="mt-2 text-[12px]" style={{ color: OFF }}>{err}</div>}
      </div>

      {/* ── REVEAL: código novo mostrado UMA vez ── */}
      {justAdded && (
        <div className="mt-3 rounded-xl border p-3" style={{ borderColor: `${OK}55`, background: `${OK}12` }}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11.5px] font-black uppercase tracking-wide" style={{ color: OK }}>✅ {justAdded.name || justAdded.email.split("@")[0]} adicionado</div>
            <button onClick={() => setJustAdded(null)} className="text-[12px] text-g-muted hover:text-g-word">✕</button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-g-ink">
            <span>🔑 Código pessoal:</span> <CodePill code={justAdded.personal_code} tag="new" />
            <a href={waLink(justAdded)} target="_blank" rel="noopener"
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] font-bold" style={{ borderColor: `${OK}55`, color: OK, background: `${OK}10` }}>
              💬 Mandar boas-vindas
            </a>
          </div>
          <div className="mt-1.5 text-[11px] text-g-muted">Anote/copie agora — o vendedor usa email + esse código pra entrar em /vendedor.</div>
        </div>
      )}

      {/* ── LISTA ── */}
      {rows === null && <div className="mt-3 h-20 animate-pulse rounded-xl border border-g-line bg-white/[0.03]" />}
      {Array.isArray(rows) && rows.length === 0 && !err && (
        <div className="mt-3 grid min-h-[70px] place-items-center rounded-xl border border-dashed border-g-line px-4 text-center text-[12.5px] text-g-muted">
          🌱 Nenhum vendedor no roster ainda — adicione o primeiro acima.
        </div>
      )}
      {Array.isArray(rows) && rows.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {rows.map((s) => {
            const conv = s.conversions;
            const isOpen = open === s.email;
            const pass = passes[s.email] || {};
            return (
              <div key={s.email} className={`rounded-xl border bg-white/[0.03] px-3 py-2.5 ${isOpen ? "border-g-green/35" : "border-g-line"}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 cursor-pointer" onClick={() => openPass(s.email)} role="button" aria-expanded={isOpen}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[13px]" style={{ borderColor: s.active ? `${OK}50` : `${OFF}45`, background: s.active ? `${OK}14` : `${OFF}12` }}>
                    {s.active ? "🟢" : "⚪"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-black text-g-word">{s.name || s.email.split("@")[0]} <span className="text-[10px] font-normal text-g-muted">{isOpen ? "▲" : "▼"}</span></div>
                    <div className="truncate text-[10.5px] text-g-muted">{s.email} · ↗ {s.ref}</div>
                  </div>
                  <span className="shrink-0 rounded-full border border-g-line bg-white/[0.04] px-2 py-0.5 text-[10.5px] font-bold text-g-ink">{s.commission_pct}%</span>
                  <button onClick={(e) => { e.stopPropagation(); toggle(s); }}
                    className="shrink-0 rounded-full border px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide"
                    style={{ borderColor: s.active ? `${OFF}45` : `${OK}45`, color: s.active ? OFF : OK, background: s.active ? `${OFF}10` : `${OK}10` }}>
                    {s.active ? "Desativar" : "Ativar"}
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-g-ink">
                  {s.personal_code && <span className="inline-flex items-center gap-1">🔑 <CodePill code={s.personal_code} tag={s.email} /></span>}
                  <span className="text-g-muted">🎯 {conv ? conv.converted : 0} conv.</span>
                  {conv && Number(conv.paid) > 0 && <span style={{ color: OK }}>💰 {usd(conv.paid)}</span>}
                  <a href={waLink(s)} target="_blank" rel="noopener" className="text-g-muted hover:text-g-word">💬 boas-vindas</a>
                  {(() => {
                    const st = invited[s.email] || "";
                    if (st === "sending") return <span className="text-g-muted">✉️ enviando…</span>;
                    if (st === "sent") return <span style={{ color: OK }}>✉️ enviado ✓</span>;
                    if (st === "err") return <span style={{ color: OFF }}>✉️ falhou — tente de novo</span>;
                    return (
                      <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-g-muted">✉️ acesso:</span>
                        <button onClick={() => invite(s, "pt")} className="rounded-full border border-g-line px-2 py-0.5 text-[10px] font-bold text-g-ink hover:border-g-green/50 hover:text-g-word" title="Enviar e-mail de acesso em português">PT</button>
                        <button onClick={() => invite(s, "en")} className="rounded-full border border-g-line px-2 py-0.5 text-[10px] font-bold text-g-ink hover:border-g-green/50 hover:text-g-word" title="Send access email in English">EN</button>
                      </span>
                    );
                  })()}
                </div>

                {/* ── PASSE ABERTO — contas a pagar (comissão refund-net) + a carteira DELE ── */}
                {isOpen && (
                  <div className="mt-2.5 border-t border-g-line pt-2.5" onClick={(e) => e.stopPropagation()}>
                    {pass.loading && <div className="h-12 animate-pulse rounded-lg bg-white/[0.04]" />}
                    {pass.err && <div className="text-[11.5px] text-g-muted">⚠️ {pass.err}</div>}
                    {pass.ledger && (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {[
                            ["💸 A pagar (comissão)", usd(pass.ledger?.totals?.commission || 0), GUI],
                            ["💰 Clientes pagaram", usd(pass.ledger?.totals?.paid || 0), OK],
                            ["🤝 Pagantes", String(pass.ledger?.totals?.clients || 0), "#5B9BD5"],
                          ].map(([l, v, c]) => (
                            <div key={l} className="min-w-0 flex-1 rounded-lg border border-g-line bg-white/[0.03] px-2.5 py-1.5">
                              <div className="text-[9px] font-bold uppercase tracking-wide text-g-muted">{l}</div>
                              <div className="text-[15px] font-black" style={{ color: c }}>{v}</div>
                            </div>
                          ))}
                        </div>
                        {Array.isArray(pass.ledger?.ledger) && pass.ledger.ledger.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {pass.ledger.ledger.slice(0, 8).map((l, i) => (
                              <div key={i} className="flex flex-wrap items-center gap-x-2.5 rounded-lg border border-g-line bg-white/[0.02] px-2.5 py-1.5 text-[11.5px]">
                                <span className="min-w-0 flex-1 truncate font-semibold text-g-word">{l.business || l.client_email}</span>
                                <span className="text-g-muted">{usd(l.paid)}</span>
                                <span className="font-black" style={{ color: GUI }}>→ {usd(l.commission)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* ── PIPELINE — drafts por status (via wallet.status) ── */}
                        {Array.isArray(pass.wallet) && pass.wallet.length > 0 && (() => {
                          const counts = pass.wallet.reduce((m, w) => { const k = stageOf(w.status); m[k] = (m[k] || 0) + 1; return m; }, {});
                          const stages = PIPE.filter((p) => counts[p.key]);
                          const other = counts.outros || 0;
                          if (stages.length === 0 && !other) return null;
                          return (
                            <div className="mt-2">
                              <div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">🚦 Pipeline</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {stages.map((p) => (
                                  <span key={p.key} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold"
                                    style={{ borderColor: `${p.color}55`, color: p.color, background: `${p.color}12` }}>
                                    {p.emoji} {p.label} <span className="font-black">{counts[p.key]}</span>
                                  </span>
                                ))}
                                {other > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-g-line px-2 py-0.5 text-[10.5px] font-bold text-g-muted">• outros <span className="font-black">{other}</span></span>}
                              </div>
                            </div>
                          );
                        })()}
                        {Array.isArray(pass.wallet) && pass.wallet.length > 0 && (
                          <div className="mt-2">
                            <div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">👛 Carteira dele ({pass.wallet.length})</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {pass.wallet.slice(0, 10).map((w, i) => (
                                <span key={i} className="rounded-full border px-2 py-0.5 text-[10.5px] font-semibold"
                                  style={w.status === "live" ? { borderColor: `${OK}45`, color: OK, background: `${OK}0d` } : { borderColor: "#5B9BD555", color: "#5B9BD5", background: "#5B9BD50d" }}>
                                  {w.business || w.client_email} {w.status === "live" ? "🟢" : "🔵"}
                                </span>
                              ))}
                              {pass.wallet.length > 10 && <span className="px-1 text-[10.5px] text-g-muted">+{pass.wallet.length - 10}</span>}
                            </div>
                          </div>
                        )}
                        {(!pass.wallet || pass.wallet.length === 0) && (!pass.ledger?.ledger || pass.ledger.ledger.length === 0) && (
                          <div className="mt-1 text-[11.5px] text-g-muted">🌱 Ainda sem clientes/comissão — a carteira dele acende no 1º cadastro.</div>
                        )}
                      </>
                    )}

                    {/* ── 💸 REPASSE — o que o dono JÁ pagou ao vendedor + registrar novo (2 cliques; dinheiro nunca 1-clique) ── */}
                    {(() => {
                      const pv = pays[s.email] || {};
                      const bal = pv.balance || null;
                      const dueCents = Number(bal?.due_cents || 0);
                      const isArmed = armed === s.email;
                      return (
                        <div className="mt-3 rounded-lg border p-2.5" style={{ borderColor: `${GUI}30`, background: `${GUI}08` }}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] font-black uppercase tracking-wide" style={{ color: GUI }}>💸 Repasse de comissão</div>
                            {pv.loading && <span className="text-[10px] text-g-muted">…</span>}
                          </div>
                          {bal && (
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {[
                                ["Comissão total", bal.commission_cents, OK],
                                ["Já repassado", bal.paid_out_cents, INFO],
                                ["Devido", bal.due_cents, GUI],
                              ].map(([l, c, col]) => (
                                <div key={l} className="min-w-0 flex-1 rounded-lg border border-g-line bg-white/[0.03] px-2 py-1">
                                  <div className="text-[8.5px] font-bold uppercase tracking-wide text-g-muted">{l}</div>
                                  <div className="text-[13px] font-black" style={{ color: col }}>${(Number(c || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* input valor (pré-preenchido com o devido) + nota */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <div className="flex items-center gap-1 rounded-lg border border-g-line bg-white/[0.05] px-2">
                              <span className="text-[12px] text-g-muted">$</span>
                              <input value={payForm[s.email]?.amount ?? ""} inputMode="decimal"
                                onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ""); setArmed(null); setPayForm((f) => ({ ...f, [s.email]: { ...(f[s.email] || {}), amount: v } })); }}
                                placeholder="0.00" className="w-20 bg-transparent py-1.5 text-[13px] text-g-word focus:outline-none" />
                            </div>
                            <input value={payForm[s.email]?.note ?? ""} onChange={(e) => setPayForm((f) => ({ ...f, [s.email]: { ...(f[s.email] || {}), note: e.target.value } }))}
                              placeholder="nota (ex: Pix 07/2026)" className="min-w-[120px] flex-1 rounded-lg border border-g-line bg-white/[0.05] px-2.5 py-1.5 text-[12px] text-g-word placeholder:text-g-muted focus:outline-none" />
                          </div>
                          {/* 2-CLIQUES: 1º arma, 2º confirma — dinheiro NUNCA é 1-clique */}
                          {!isArmed ? (
                            <button
                              onClick={() => { const a = parseFloat((payForm[s.email]?.amount || "").toString().replace(",", ".")); if (a > 0) { setPayForm((f) => ({ ...f, [s.email]: { ...(f[s.email] || {}), key: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)) } })); setArmed(s.email); } }}
                              disabled={!(parseFloat((payForm[s.email]?.amount || "").toString().replace(",", ".")) > 0)}
                              className="mt-2 w-full rounded-lg border px-3 py-1.5 text-[12px] font-black disabled:opacity-40"
                              style={{ borderColor: `${GUI}55`, color: GUI, background: `${GUI}10` }}>
                              💸 Marcar repasse pago
                            </button>
                          ) : (
                            <div className="mt-2 rounded-lg border p-2" style={{ borderColor: `${AMBER}66`, background: `${AMBER}12` }}>
                              <div className="text-[11.5px] font-bold" style={{ color: AMBER }}>
                                ⚠️ Confirmar repasse de <span className="font-black">${(parseFloat((payForm[s.email]?.amount || "0").toString().replace(",", ".")) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> para <span className="font-black">{s.name || s.email}</span>?
                              </div>
                              <div className="mt-2 flex gap-2">
                                <button onClick={() => recordPayout(s)} disabled={paying}
                                  className="flex-1 rounded-lg px-3 py-1.5 text-[12px] font-black text-black disabled:opacity-60" style={{ background: OK }}>
                                  {paying ? "…" : "✅ Confirmar pagamento"}
                                </button>
                                <button onClick={() => setArmed(null)} disabled={paying}
                                  className="rounded-lg border border-g-line px-3 py-1.5 text-[12px] font-bold text-g-ink">Cancelar</button>
                              </div>
                            </div>
                          )}
                          {pv.err && <div className="mt-1.5 text-[11px]" style={{ color: OFF }}>⚠️ {pv.err}</div>}
                          {/* histórico de repasses */}
                          {Array.isArray(pv.payouts) && pv.payouts.length > 0 && (
                            <div className="mt-2">
                              <div className="text-[9px] font-bold uppercase tracking-wide text-g-muted">Histórico ({pv.payouts.length})</div>
                              <div className="mt-1 space-y-1">
                                {pv.payouts.slice(0, 6).map((p, i) => (
                                  <div key={i} className="flex flex-wrap items-center gap-x-2 rounded-lg border border-g-line bg-white/[0.02] px-2 py-1 text-[11px]">
                                    <span className="font-black" style={{ color: OK }}>${(Number(p.amount_cents || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                    {p.period && <span className="text-g-muted">{p.period}</span>}
                                    {p.note && <span className="min-w-0 flex-1 truncate text-g-ink">{p.note}</span>}
                                    {p.created_at && <span className="text-g-muted">{String(p.created_at).slice(0, 10)}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {Array.isArray(pv.payouts) && pv.payouts.length === 0 && !pv.loading && (
                            <div className="mt-1.5 text-[10.5px] text-g-muted">Nenhum repasse registrado ainda.</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
