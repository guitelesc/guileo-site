import { useEffect, useState } from "react";

// 💰 Finanças da Companhia — o razão da PRÓPRIA Guileo (despesas/investimentos/receita), separado do
// custo-por-cliente. Lê /api/company-finance (admin-gated). Light theme to match Admin.jsx.
const money = (c) => "$" + (Number(c || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DEPTS = ["finance", "sales", "marketing", "operations", "growth", "intelligence", "support", "crm"];
const KINDS = ["expense", "investment", "revenue"];
const RECUR = ["", "monthly", "yearly", "per_use"];

export default function CompanyFinance({ token }) {
  const [sum, setSum] = useState(null);
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ department: "finance", kind: "expense", category: "", vendor: "", description: "", amount: "", recurring: "monthly", notes: "" });

  const call = (body) => fetch("/api/company-finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...body }) }).then((r) => r.json());
  const load = async () => {
    try {
      const [s, l] = await Promise.all([call({ action: "summary" }), call({ action: "list" })]);
      if (s.error && l.error) { setState("err"); return; }
      setSum(s.summary || null); setRows(l.rows || []); setState("ok");
    } catch { setState("err"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  const add = async (e) => {
    e.preventDefault();
    if (!f.description.trim()) return;
    setBusy(true);
    await call({ action: "add", ...f, amount: Number(f.amount) || 0 });
    setF({ ...f, category: "", vendor: "", description: "", amount: "", notes: "" });
    setOpen(false); await load(); setBusy(false);
  };

  const kindTone = (k) => k === "revenue" ? "text-g-green" : k === "investment" ? "text-sky-600" : "text-[#c8623c]";

  return (
    <div className="mt-6 rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">💰 Finanças da Companhia</div>
          <p className="text-[12px] text-g-muted">Despesas, investimentos e receita da própria Guileo — separado do custo por cliente.</p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={load} className="rounded-full border border-g-line px-3 py-1.5 text-[12px] font-bold text-g-muted hover:text-g-word">↻</button>
          <button onClick={() => setOpen((o) => !o)} className="rounded-full bg-gradient-to-r from-g-green to-g-dark px-3.5 py-1.5 text-[12px] font-bold text-white">{open ? "Fechar" : "+ Lançar"}</button>
        </div>
      </div>

      {state === "loading" && <div className="mt-4 text-[13px] text-g-muted">Carregando…</div>}
      {state === "err" && <div className="mt-4 text-[13px] text-[#c8623c]">Não consegui carregar — confira o token de admin (ou aplique as RPCs do company_ledger).</div>}

      {state === "ok" && sum && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ["Fixo / mês", money(sum.monthly_recurring_cents), "recorrente mensal", "#c8623c"],
            ["Por uso", money(sum.per_use_cents) + "/un", "custo variável", "#e0855f"],
            ["Investimento", money(sum.investment_cents), "aportes", "#5B8DEF"],
            ["Receita", money(sum.revenue_cents), "entrada", "#3E9468"],
          ].map(([label, val, sub, col]) => (
            <div key={label} className="rounded-xl border border-g-line bg-white/[0.03] px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-g-muted">{label}</div>
              <div className="mt-0.5 text-[17px] font-black tabular-nums" style={{ color: col }}>{val}</div>
              <div className="text-[10px] text-g-muted/70">{sub}</div>
            </div>
          ))}
        </div>
      )}

      {state === "ok" && sum && sum.by_department && Object.keys(sum.by_department).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(sum.by_department).map(([d, c]) => (
            <span key={d} className="rounded-full border border-g-line bg-white/[0.03] px-2.5 py-1 text-[11px] text-g-ink">{d}: <b className="text-g-word">{money(c)}</b></span>
          ))}
        </div>
      )}

      {open && (
        <form onSubmit={add} className="mt-4 grid gap-2 rounded-xl border border-g-line bg-white/[0.03] p-3 sm:grid-cols-2">
          <label className="text-[11px] font-bold text-g-muted">Departamento<select value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} className="mt-1 block w-full rounded-lg border border-g-line bg-white/[0.05] px-2 py-1.5 text-[12px] text-g-word">{DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
          <label className="text-[11px] font-bold text-g-muted">Tipo<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className="mt-1 block w-full rounded-lg border border-g-line bg-white/[0.05] px-2 py-1.5 text-[12px] text-g-word">{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
          <label className="text-[11px] font-bold text-g-muted">Fornecedor<input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} placeholder="ElevenLabs, Twilio…" className="mt-1 block w-full rounded-lg border border-g-line bg-white/[0.05] px-2.5 py-1.5 text-[12px] text-g-word placeholder:text-g-muted" /></label>
          <label className="text-[11px] font-bold text-g-muted">Categoria<input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Voice, Infra, Comms…" className="mt-1 block w-full rounded-lg border border-g-line bg-white/[0.05] px-2.5 py-1.5 text-[12px] text-g-word placeholder:text-g-muted" /></label>
          <label className="text-[11px] font-bold text-g-muted sm:col-span-2">Descrição<input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="o que é esse lançamento" className="mt-1 block w-full rounded-lg border border-g-line bg-white/[0.05] px-2.5 py-1.5 text-[12px] text-g-word placeholder:text-g-muted" /></label>
          <label className="text-[11px] font-bold text-g-muted">Valor (US$)<input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0.00" className="mt-1 block w-full rounded-lg border border-g-line bg-white/[0.05] px-2.5 py-1.5 text-[12px] text-g-word placeholder:text-g-muted" /></label>
          <label className="text-[11px] font-bold text-g-muted">Recorrência<select value={f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.value })} className="mt-1 block w-full rounded-lg border border-g-line bg-white/[0.05] px-2 py-1.5 text-[12px] text-g-word">{RECUR.map((r) => <option key={r} value={r}>{r || "única"}</option>)}</select></label>
          <button disabled={busy} className="rounded-lg bg-gradient-to-r from-g-green to-g-dark px-3.5 py-2 text-[12px] font-bold text-white disabled:opacity-50 sm:col-span-2">{busy ? "Lançando…" : "Registrar"}</button>
        </form>
      )}

      {state === "ok" && (
        <div className="mt-3 space-y-1.5">
          {rows.length === 0 ? <div className="text-[13px] text-g-muted py-4 text-center">Nenhum lançamento ainda.</div>
            : rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-g-line bg-white/[0.03] px-3.5 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-g-word truncate">{r.vendor ? r.vendor + " · " : ""}{r.description}</div>
                  <div className="text-[10.5px] text-g-muted">{r.department} · {r.category}{r.recurring ? " · " + r.recurring : ""}{r.notes ? " · " + r.notes : ""}</div>
                </div>
                <div className={`shrink-0 text-[14px] font-black tabular-nums ${kindTone(r.kind)}`}>{r.kind === "revenue" ? "+" : "−"}{money(r.amount_cents)}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
