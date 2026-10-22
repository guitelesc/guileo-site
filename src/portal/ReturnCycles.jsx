/* "Return reminders" — de quanto em quanto tempo cada serviço pede uma volta.
   Mora dentro da tela "Dates & birthdays". O dono vê cada serviço com o número de dias em que a Gui
   lembra a cliente de voltar; 0 = nunca. Serviço ainda sem decisão aparece com a SUGESTÃO pelo nome
   (cicloRetorno.js, no servidor) já preenchida — mas nada vale até ele apertar Salvar.
   Só modo real: sem chave de conexão esta seção não existe (não há amostra para inventar). */
import { useState, useEffect } from "react";
import { toast } from "../lib/portalApi.js";
import { tr } from "../pages/Portal.jsx";

async function chamar(email, dataKey, corpo) {
  try {
    const r = await fetch("/api/ciclo-retorno", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, token: dataKey, ...corpo }) });
    const d = await r.json().catch(() => null);
    return d && typeof d === "object" ? d : { ok: false };
  } catch { return { ok: false }; }
}

export default function ReturnCycles({ email = "", dataKey = "" }) {
  const [lista, setLista] = useState(null);      // null = lendo · false = falhou · [] = sem serviços
  const [valor, setValor] = useState({});        // id → texto do campo
  const [busy, setBusy] = useState(false);

  const ler = async () => {
    setLista(null);
    const d = await chamar(email, dataKey, { action: "list" });
    if (!(d.ok && Array.isArray(d.services))) { setLista(false); return; }
    setLista(d.services);
    const v = {};
    for (const s of d.services) v[s.id] = String(s.days === null ? s.suggested : s.days);
    setValor(v);
  };
  useEffect(() => { if (dataKey) ler(); }, [email, dataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dataKey) return null;

  const mudou = Array.isArray(lista) ? lista.filter((s) => {
    const n = Number.parseInt(valor[s.id], 10);
    return Number.isInteger(n) && n >= 0 && n <= 730 && n !== s.days;
  }) : [];
  const invalido = Array.isArray(lista) && lista.some((s) => { const t = String(valor[s.id] ?? "").trim(); const n = Number(t); return t === "" || !Number.isInteger(n) || n < 0 || n > 730; });

  const salvar = async () => {
    if (busy || !mudou.length || invalido) return;
    setBusy(true);
    const d = await chamar(email, dataKey, { action: "set", cycles: mudou.map((s) => ({ id: s.id, days: Number.parseInt(valor[s.id], 10) })) });
    setBusy(false);
    // sucesso só com o número de serviços que o servidor disse ter mudado
    if (d.ok && d.changed === mudou.length) { toast(tr("Saved ✓")); ler(); }
    else toast(tr("Couldn't save — try again."));
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <div className="text-sm font-extrabold text-g-word">🌿 {tr("Return reminders")}</div>
        <div className="text-[11px] text-g-muted max-w-xl">{tr("How many days after each service Gui reminds the customer to come back. 0 means never. Customers who already have a future booking are not reminded.")}</div>
      </div>
      {lista === null && <div className="px-5 py-4 text-xs text-g-muted">{tr("Reading your services…")}</div>}
      {lista === false && (
        <div className="px-5 py-4 text-xs text-g-muted flex flex-wrap items-center gap-3">
          <span>{tr("Couldn't read your services")}</span>
          <button onClick={ler} className="btn-ghost text-xs">{tr("Try again")}</button>
        </div>
      )}
      {Array.isArray(lista) && lista.length === 0 && <div className="px-5 py-4 text-xs text-g-muted">{tr("No services yet — add your services first.")}</div>}
      {Array.isArray(lista) && lista.length > 0 && (
        <>
          <div className="divide-y divide-white/[0.06]">
            {lista.map((s) => (
              <label key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="min-w-0 flex-1 text-xs text-g-word break-words">
                  {s.name}
                  {s.days === null && <span className="ml-2 text-[10px] font-bold text-g-gold whitespace-nowrap">{tr("suggested — not saved yet")}</span>}
                </span>
                <input type="number" inputMode="numeric" min={0} max={730} value={valor[s.id] ?? ""} aria-label={`${tr("Days until the reminder")} — ${s.name}`}
                  onChange={(e) => setValor((v) => ({ ...v, [s.id]: e.target.value }))}
                  className="w-20 shrink-0 bg-white/[0.05] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-g-word text-right tabular-nums outline-none focus:border-white/40" />
                <span className="w-9 shrink-0 text-[11px] text-g-muted">{tr("days")}</span>
              </label>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-g-muted">{invalido ? tr("Use a whole number from 0 to 730.") : mudou.length ? `${mudou.length} ${tr("to save")}` : tr("Everything is saved.")}</span>
            <button onClick={salvar} disabled={busy || !mudou.length || invalido} className="btn-bright text-xs disabled:opacity-50">{busy ? "…" : tr("Save reminders")}</button>
          </div>
        </>
      )}
    </div>
  );
}
