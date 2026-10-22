/* AGENDA DA PROFISSIONAL (2026-10-05) — o que a terapeuta abre no celular pelo /balcao com o código DELA.
   Só o dia dela (o servidor filtra: functions/lib/deskAcesso.js → filtrarAgendaDela), sem contato das clientes,
   com "Chegou", "Terminei" e nota. Faltou/cancelar/remarcar continuam com o balcão. Atualiza a cada 2 min. */
import { useState, useEffect, useCallback } from "react";
import { toast } from "../lib/portalApi.js";
import { chamarDesk, motivo, tx, paraUtc, diaDe, somaDias, minutoDe, hhmm, loc } from "./deskApi.js";

const TZ0 = "America/New_York";
const COR = { booked: "#3FB4FF", confirmed: "#2FE39A", in_progress: "#FFC23D", completed: "#8E8A80", no_show: "#FF5A5A", cancelled: "#5a564e", blocked: "#6b665c", hold: "#C9A4FF" };
const T = {
  hi: { en: "Hi", pt: "Olá", es: "Hola" },
  today: { en: "Today", pt: "Hoje", es: "Hoy" },
  none: { en: "No clients on this day.", pt: "Nenhuma cliente neste dia.", es: "Ninguna clienta este día." },
  count: { en: "clients", pt: "clientes", es: "clientas" },
  next: { en: "next at", pt: "próxima às", es: "próxima a las" },
  arrived: { en: "She's here", pt: "Chegou", es: "Llegó" },
  done: { en: "Done", pt: "Terminei", es: "Terminé" },
  note: { en: "Note", pt: "Nota", es: "Nota" },
  save: { en: "Save note", pt: "Salvar nota", es: "Guardar nota" },
  saved: { en: "Saved", pt: "Salvo", es: "Guardado" },
  blocked: { en: "Blocked", pt: "Bloqueado", es: "Bloqueado" },
  readFail: { en: "Couldn't load your day. Pull to try again.", pt: "Não consegui abrir o seu dia. Tente de novo.", es: "No pude abrir tu día. Inténtalo de nuevo." },
  retry: { en: "Try again", pt: "Tentar de novo", es: "Reintentar" },
  desk: { en: "Missed, cancel or reschedule? Ask the front desk.", pt: "Faltou, cancelar ou remarcar? Fale com a recepção.", es: "¿Faltó, cancelar o reprogramar? Habla con recepción." },
  st: {
    booked: { en: "Booked", pt: "Marcado", es: "Reservado" }, confirmed: { en: "Confirmed", pt: "Confirmado", es: "Confirmado" },
    in_progress: { en: "With you", pt: "Em atendimento", es: "En atención" }, completed: { en: "Done", pt: "Terminado", es: "Terminado" },
    no_show: { en: "No-show", pt: "Faltou", es: "No vino" }, cancelled: { en: "Cancelled", pt: "Cancelado", es: "Cancelado" }, hold: { en: "On hold", pt: "Reservado", es: "Reservado" },
  },
};

export default function DeskMinhaAgenda({ email, dataKey, nome = "" }) {
  const [tz, setTz] = useState(TZ0);
  const [dia, setDia] = useState(() => diaDe(new Date(), TZ0));
  const [estado, setEstado] = useState({ fase: "lendo", dados: null });
  const [seq, setSeq] = useState(0);
  const [aberta, setAberta] = useState("");          // id do agendamento com a nota aberta
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    let vivo = true;
    chamarDesk(email, dataKey, { action: "agenda", from: paraUtc(dia, 0, tz).toISOString(), to: paraUtc(somaDias(dia, 1), 0, tz).toISOString() }).then(({ d }) => {
      if (!vivo) return;
      if (d?.ok === true) {
        const z = d.locations?.[0]?.tz;
        if (z && z !== tz) { setTz(z); setDia(diaDe(new Date(), z)); return; }   // relê no fuso da unidade
        setEstado({ fase: "ok", dados: d });
      } else setEstado((e) => ({ fase: e.dados ? "ok" : "erro", dados: e.dados }));
    });
    return () => { vivo = false; };
  }, [email, dataKey, dia, tz, seq]);
  useEffect(() => { const i = setInterval(() => { setSeq((n) => n + 1); setAgora(Date.now()); }, 120000); return () => clearInterval(i); }, []);

  const agir = useCallback(async (corpo, ok) => {
    setOcupado(corpo.id + corpo.action);
    const { http, d } = await chamarDesk(email, dataKey, corpo);
    setOcupado("");
    if (d?.ok === true) { if (ok) toast(ok); setSeq((n) => n + 1); return true; }
    toast(motivo(d, http)); return false;
  }, [email, dataKey]);

  const dados = estado.dados;
  const servico = (id) => (dados?.services || []).find((s) => s.id === id)?.name || "";
  const unidades = dados?.locations || [];
  const nomeUnidade = (id) => (unidades.length > 1 ? unidades.find((l) => l.id === id)?.name || "" : "");
  const lista = (dados?.appointments || []).filter((a) => a.status !== "cancelled").sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const clientes = lista.filter((a) => a.status !== "blocked");
  const proxima = clientes.find((a) => Date.parse(a.start) > agora && !["completed", "no_show"].includes(a.status));
  const hoje = diaDe(new Date(), tz);
  const tituloCru = new Date(`${dia}T12:00:00Z`).toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const titulo = tituloCru.charAt(0).toUpperCase() + tituloCru.slice(1);   // "Segunda-feira, 5 de outubro" (não "De Outubro")

  const btn = "rounded-full px-4 py-2.5 min-h-[44px] text-sm font-extrabold disabled:opacity-40";
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <div className="text-sm font-bold text-g-muted">{tx(T.hi)}{nome ? `, ${nome}` : ""}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold leading-tight text-g-word">{titulo}</h1>
          <div className="flex shrink-0 items-center gap-1">
            <button aria-label="‹" onClick={() => setDia(somaDias(dia, -1))} className="h-11 w-11 rounded-full border border-white/10 text-lg text-g-word">‹</button>
            {dia !== hoje && <button onClick={() => setDia(hoje)} className="h-11 rounded-full border border-white/10 px-3 text-xs font-bold text-g-word">{tx(T.today)}</button>}
            <button aria-label="›" onClick={() => setDia(somaDias(dia, 1))} className="h-11 w-11 rounded-full border border-white/10 text-lg text-g-word">›</button>
          </div>
        </div>
        {estado.fase === "ok" && (
          <div className="mt-1 text-sm text-g-muted num">
            {clientes.length} {tx(T.count)}{proxima ? ` · ${tx(T.next)} ${hhmm(minutoDe(proxima.start, tz))}` : ""}
          </div>
        )}
      </div>

      {estado.fase === "lendo" && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>}
      {estado.fase === "erro" && (
        <div className="rounded-2xl border border-g-gold/30 bg-g-gold/10 p-4 text-sm font-bold text-g-gold">
          {tx(T.readFail)} <button onClick={() => setSeq((n) => n + 1)} className="ml-2 underline">{tx(T.retry)}</button>
        </div>
      )}
      {estado.fase === "ok" && lista.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-g-muted">{tx(T.none)}</div>}

      <ul className="space-y-2.5">
        {estado.fase === "ok" && lista.map((a) => {
          const ini = minutoDe(a.start, tz), fim = minutoDe(a.end, tz);
          if (a.status === "blocked") {
            return (
              <li key={a.id} className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-g-muted num">
                {hhmm(ini)}–{hhmm(fim)} · {tx(T.blocked)}{a.note ? ` · ${a.note}` : ""}
              </li>
            );
          }
          const passou = Date.parse(a.end) < agora;
          const cor = COR[a.status] || COR.booked;
          return (
            <li key={a.id} className={`rounded-2xl border bg-white/[0.035] p-4 ${proxima?.id === a.id ? "border-g-green/50" : "border-white/10"} ${passou && a.status === "completed" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-extrabold text-g-word num">{hhmm(ini)}<span className="text-sm font-bold text-g-muted"> – {hhmm(fim)}</span></div>
                  <div className="mt-0.5 truncate text-base font-bold text-g-word">{a.customer_name || "—"}</div>
                  <div className="truncate text-sm text-g-muted">{servico(a.service_id)}{nomeUnidade(a.location_id) ? ` · ${nomeUnidade(a.location_id)}` : ""}</div>
                </div>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: `${cor}22`, color: cor }}>{tx(T.st[a.status] || T.st.booked)}</span>
              </div>
              {a.alert && <div className="mt-2 rounded-xl border border-[#FF5A5A]/30 bg-[#FF5A5A]/10 px-3 py-2 text-sm font-bold text-[#FF8A8A]">⚠ {a.alert}</div>}
              {a.note && aberta !== a.id && <div className="mt-2 text-sm text-g-muted">“{a.note}”</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {["booked", "confirmed", "hold"].includes(a.status) && (
                  <button disabled={!!ocupado} onClick={() => agir({ action: "status", id: a.id, status: "arrived" }, tx(T.st.in_progress))} className={`${btn} bg-g-green text-[#161512]`}>{tx(T.arrived)}</button>
                )}
                {a.status === "in_progress" && (
                  <button disabled={!!ocupado} onClick={() => agir({ action: "status", id: a.id, status: "completed" }, tx(T.st.completed))} className={`${btn} bg-g-green text-[#161512]`}>{tx(T.done)}</button>
                )}
                <button onClick={() => { setAberta(aberta === a.id ? "" : a.id); setNota(a.note || ""); }} className={`${btn} border border-white/15 text-g-word`}>{tx(T.note)}</button>
              </div>
              {aberta === a.id && (
                <div className="mt-3 space-y-2">
                  <textarea value={nota} onChange={(e) => setNota(e.target.value.slice(0, 1000))} rows={3} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[15px] text-g-word outline-none focus:border-g-green/60 [color-scheme:dark]" />
                  <button disabled={!!ocupado} onClick={async () => { if (await agir({ action: "note", id: a.id, note: nota }, tx(T.saved))) setAberta(""); }} className={`${btn} bg-g-green text-[#161512]`}>{tx(T.save)}</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {estado.fase === "ok" && clientes.length > 0 && <p className="text-center text-xs text-g-muted">{tx(T.desk)}</p>}
    </div>
  );
}
