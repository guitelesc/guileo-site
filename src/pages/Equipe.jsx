/* ═══════════════════════════════════════════════════════════════════════════
   HUB DA EQUIPE — /equipe (aliases /tecnico e /marketing)
   Dois hubs internos numa porta só, cada um com sua fila e seus números REAIS:

   🛠 SUPORTE TÉCNICO — a equipe de dev (backend/frontend/integrações) trabalha aqui.
      Fila global de chamados TÉCNICOS: urgente primeiro, mais antigo primeiro, com o
      relógio de SLA em cima (abertos · urgentes · parados >24h · fechados hoje) pra
      nada envelhecer sem alguém ver. Responder, mudar status/dono e devolver pra
      primeira linha quando não era técnico.

   📊 MARKETING / ADS / PERFORMANCE — os números da empresa e de CADA cliente da
      carteira: eventos por canal (de onde vem o movimento), leads, agendamentos,
      créditos, e quem está performando vs quem está parado.

   Acesso: e-mail + código do time (TECH_TEAM_CODE / MARKETING_TEAM_CODE / TECH_ROSTER
   no Cloudflare) ou a senha do dono. Sem env configurada, o hub diz isso na cara em vez
   de fingir que está no ar. Nada é inventado: fila vazia é fila vazia, zero é zero.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const KEY = "guileo_equipe";
const api = async (body) => {
  try {
    const r = await fetch("/api/support-hub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await r.json().catch(() => ({}));
  } catch { return {}; }
};
const loadMe = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const saveMe = (m) => { try { m ? localStorage.setItem(KEY, JSON.stringify(m)) : localStorage.removeItem(KEY); } catch { /* private mode */ } };
const ago = (ts) => {
  if (!ts) return "";
  const h = Math.floor((Date.now() - new Date(ts).getTime()) / 36e5);
  if (h < 1) return "agora";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};
const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");

// ── Login do time ────────────────────────────────────────────────────────────
function Login({ onIn }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");
  const field = "w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-[14px] text-g-word placeholder:text-g-muted/50 focus:outline-none focus:border-g-green/50";

  const submit = async (e) => {
    e.preventDefault();
    setState("go"); setMsg("");
    // Uma chamada real valida o acesso. FIX #5 (revisor 2026-07-31): validar SÓ pela fila técnica
    // trancava o time de MARKETING pra fora do próprio hub (o código deles é outro). Tenta técnico e,
    // se não for, tenta marketing — quem tiver qualquer um dos dois entra, na aba certa.
    const em = email.trim(), cd = code.trim();
    const t = await api({ action: "tech_queue", tech_email: em, tech_code: cd, token: cd });
    if (t && t.ok) { const me = { email: em, code: cd, role: "tech" }; saveMe(me); onIn(me); return; }
    const m = await api({ action: "mkt_stats", email: em, code: cd, token: cd, days: 30 });
    if (m && m.ok) { const me = { email: em, code: cd, role: "mkt" }; saveMe(me); onIn(me); return; }
    setState("idle");
    setMsg((t && t.configured === false) && (m && m.configured === false)
      ? "O acesso do time ainda não foi configurado. Peça ao Luis pra definir TECH_TEAM_CODE e/ou MARKETING_TEAM_CODE no Cloudflare."
      : "E-mail ou código inválido.");
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#161512] px-4">
      <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur">
        <div className="text-[10px] font-black uppercase tracking-[3px] text-g-gold">Área interna</div>
        <h1 className="mt-1 text-2xl font-black text-g-word">Hub da Equipe</h1>
        <p className="mt-1 text-[13px] text-g-muted">Suporte técnico e marketing/performance da Guileo. Acesso restrito ao time.</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu e-mail" type="email" required className={`${field} mt-5`} />
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código do time" type="password" required className={`${field} mt-3`} />
        <button disabled={state === "go"} className="btn-bright mt-4 w-full text-[14px]">{state === "go" ? "Entrando…" : "Entrar"}</button>
        {msg && <p className="mt-3 text-[12.5px] text-g-gold leading-relaxed">{msg}</p>}
      </motion.form>
    </div>
  );
}

// ── 🛠 Suporte técnico ───────────────────────────────────────────────────────
function Tecnico({ me }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [reply, setReply] = useState({});
  const load = async () => {
    setData(null);
    const d = await api({ action: "tech_queue", tech_email: me.email, tech_code: me.code, token: me.code });
    setData(d && d.ok ? d : { tickets: [], stats: {}, ready: false });
  };
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); /* eslint-disable-next-line */ }, []);

  // FIX #7 (revisor 2026-07-31): a ação descartava a resposta — "✓ Resolvido" parecia idêntico tendo
  // funcionado ou não (RPC recusada = sucesso falso). Agora confirma e avisa quando falha.
  const [err, setErr] = useState("");
  const act = async (body, label) => {
    setBusy(label); setErr("");
    const d = await api({ ...body, tech_email: me.email, tech_code: me.code, token: me.code });
    setBusy(null);
    if (!d || !d.ok) setErr(d && d.note ? d.note : "Não consegui salvar essa ação — tente de novo.");
    load();
  };

  const s = (data && data.stats) || {};
  const tickets = (data && data.tickets) || [];
  const TILES = [
    ["Abertos", s.open, "#FF8A33"], ["Urgentes", s.urgent, "#E5484D"],
    ["Parados >24h", s.aging_24h, "#FFC23D"], ["1ª linha", s.front_line, "#3FB4FF"],
    ["Fechados 24h", s.closed_today, "#3E9468"],
  ];

  return (
    <div className="space-y-5">
      {err && (
        <div className="rounded-xl border border-g-live/40 bg-g-live/[0.08] px-4 py-2.5 text-[12.5px] font-bold text-g-word">⚠️ {err}</div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {TILES.map(([label, val, color]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">{label}</div>
            <div className="mt-0.5 text-2xl font-black tabular-nums" style={{ color }}>{data === null ? "—" : fmt(val)}</div>
          </div>
        ))}
      </div>

      {data === null && <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />}
      {data && !data.ready && (
        <div className="rounded-2xl border border-g-gold/25 bg-g-gold/[0.06] p-4 text-[13px] text-g-gold">
          A fila técnica ainda não respondeu — confira se o SQL de suporte está aplicado no banco.
        </div>
      )}
      {data && data.ready && tickets.length === 0 && (
        <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.05] p-6 text-center">
          <div className="text-2xl">✅</div>
          <div className="mt-1 text-[14px] font-bold text-g-word">Nenhum chamado técnico aberto</div>
          <p className="text-[12.5px] text-g-muted mt-0.5">Quando o vendedor escalar algo, aparece aqui na hora.</p>
        </div>
      )}

      {tickets.map((t) => (
        <div key={t.id} className={`rounded-2xl border p-4 ${t.urgent ? "border-[#E5484D]/40 bg-[#E5484D]/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
          <div className="flex flex-wrap items-start gap-2">
            {t.urgent && <span className="rounded-full bg-[#E5484D]/20 px-2 py-0.5 text-[10px] font-black uppercase text-[#E5484D]">urgente</span>}
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-extrabold text-g-word">{t.subject || "(sem assunto)"}</div>
              <div className="text-[11.5px] text-g-muted">{t.client_email} · {t.category || "geral"} · aberto há {ago(t.created_at)}{t.assigned_to ? ` · ${t.assigned_to}` : ""}</div>
            </div>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10.5px] font-bold text-g-word">{t.status || "open"}</span>
          </div>

          {Array.isArray(t.thread) && t.thread.length > 0 && (
            <div className="mt-2.5 space-y-1 rounded-xl border border-white/8 bg-[#0d0c0a]/40 p-2.5 max-h-40 overflow-y-auto">
              {t.thread.slice(-6).map((m, i) => (
                <div key={i} className="text-[12px] leading-relaxed"><span className="text-g-muted">{m.role}:</span> <span className="text-g-word">{m.text}</span></div>
              ))}
            </div>
          )}

          <textarea value={reply[t.id] || ""} onChange={(e) => setReply((r) => ({ ...r, [t.id]: e.target.value }))}
            placeholder="Responder / anotar a solução…" rows={2}
            className="mt-2.5 w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[12.5px] text-g-word placeholder:text-g-muted/50 focus:outline-none focus:border-g-green/40" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button disabled={busy === t.id + "r" || !(reply[t.id] || "").trim()}
              onClick={() => { act({ action: "tech_reply", id: t.id, text: reply[t.id] }, t.id + "r"); setReply((r) => ({ ...r, [t.id]: "" })); }}
              className="btn-bright text-[12px] py-1.5 disabled:opacity-40">Responder</button>
            <button disabled={busy === t.id + "p"} onClick={() => act({ action: "tech_set", id: t.id, status: "in_progress" }, t.id + "p")}
              className="btn-ghost text-[12px] py-1.5">▶ Assumir</button>
            <button disabled={busy === t.id + "c"} onClick={() => act({ action: "tech_set", id: t.id, status: "resolved", resolution: reply[t.id] || "" }, t.id + "c")}
              className="btn-ghost text-[12px] py-1.5">✓ Resolvido</button>
            <button disabled={busy === t.id + "b"} onClick={() => act({ action: "tech_return", id: t.id, note: reply[t.id] || "" }, t.id + "b")}
              className="btn-ghost text-[12px] py-1.5">↩ Devolver p/ atendimento</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 📊 Marketing / Ads / Performance ─────────────────────────────────────────
function Marketing({ me }) {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  useEffect(() => {
    let alive = true;
    setData(null);
    api({ action: "mkt_stats", email: me.email, code: me.code, token: me.code, days }).then((d) => { if (alive) setData(d && d.ok ? (d.data || {}) : {}); });
    return () => { alive = false; };
  }, [days, me.email, me.code]);

  const t = (data && data.totals) || {};
  const channels = (data && data.channels) || [];
  const clients = (data && data.clients) || [];
  const maxCh = Math.max(1, ...channels.map((c) => Number(c.n || 0)));
  const TILES = [
    ["Clientes", t.clients, "#EFECE6"], ["Interações", t.events, "#FF8A33"],
    ["Leads", t.leads, "#3FB4FF"], ["Agendamentos", t.appointments, "#3E9468"],
    ["Créditos na base", t.credits_left, "#C08A3E"],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">Período</div>
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`rounded-full px-3 py-1 text-[12px] font-bold ring-1 transition ${days === d ? "bg-g-green/15 text-g-word ring-g-green/40" : "text-g-muted ring-white/10 hover:text-g-word"}`}>{d} dias</button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {TILES.map(([label, val, color]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">{label}</div>
            <div className="mt-0.5 text-2xl font-black tabular-nums" style={{ color }}>{data === null ? "—" : fmt(val)}</div>
          </div>
        ))}
      </div>

      {/* De onde vem o movimento — canal real registrado, sem estimativa */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="text-[11px] font-black uppercase tracking-wide text-g-gold">📡 De onde vem o movimento</div>
        {data === null ? <div className="mt-3 h-20 animate-pulse rounded-xl bg-white/[0.03]" />
          : channels.length === 0 ? <p className="mt-2 text-[12.5px] text-g-muted">Sem interação registrada nesse período.</p>
          : (
            <div className="mt-3 space-y-2">
              {channels.map((c) => (
                <div key={c.channel} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-[12px] font-bold text-g-word truncate">{c.channel}</div>
                  <div className="h-2.5 flex-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full rounded-full bg-[#FF8A33]" style={{ width: `${Math.round((Number(c.n) / maxCh) * 100)}%` }} />
                  </div>
                  <div className="w-12 shrink-0 text-right text-[12px] font-black text-g-word tabular-nums">{fmt(c.n)}</div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Carteira — quem performa e quem está parado */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="text-[11px] font-black uppercase tracking-wide text-g-gold">👛 Carteira — performance por cliente</div>
        {data === null ? <div className="mt-3 h-24 animate-pulse rounded-xl bg-white/[0.03]" />
          : clients.length === 0 ? <p className="mt-2 text-[12.5px] text-g-muted">Nenhum cliente no escopo ainda.</p>
          : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">
                    <th className="px-2 py-1 text-left">Cliente</th>
                    <th className="px-2 py-1 text-right">Interações</th>
                    <th className="px-2 py-1 text-right">Leads</th>
                    <th className="px-2 py-1 text-right">Agend.</th>
                    <th className="px-2 py-1 text-right">Última ação</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => {
                    const cold = !c.last_activity || (Date.now() - new Date(c.last_activity).getTime()) > 7 * 864e5;
                    return (
                      <tr key={c.client_email} className="border-t border-white/8">
                        <td className="px-2 py-2 font-bold text-g-word truncate max-w-[220px]">{c.client_email}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-g-ink">{fmt(c.events)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-g-ink">{fmt(c.leads)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-g-ink">{fmt(c.appointments)}</td>
                        <td className={`px-2 py-2 text-right ${cold ? "text-[#E5484D]" : "text-g-muted"}`}>{c.last_activity ? ago(c.last_activity) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function Equipe() {
  const [me, setMe] = useState(loadMe);
  const [tab, setTab] = useState(() => (typeof window !== "undefined" && /marketing/i.test(window.location.pathname) ? "mkt" : "tec"));
  if (!me) return <Login onIn={setMe} />;

  return (
    <div className="min-h-screen bg-[#161512] text-g-word">
      <div className="sticky top-0 z-20 border-b border-white/8 bg-[#161512]/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[3px] text-g-gold">Área interna</div>
            <div className="text-[15px] font-black">Hub da Equipe</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {[["tec", "🛠 Suporte técnico"], ["mkt", "📊 Marketing"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${tab === k ? "bg-g-green/15 text-g-word ring-1 ring-g-green/40" : "text-g-muted hover:text-g-word"}`}>{label}</button>
            ))}
            <button onClick={() => { saveMe(null); setMe(null); }} className="rounded-full border border-white/15 px-3 py-1.5 text-[11.5px] font-bold text-g-muted hover:text-g-word">Sair</button>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 py-6">
        {tab === "tec" ? <Tecnico me={me} /> : <Marketing me={me} />}
      </div>
    </div>
  );
}
