/* PONTO DA EQUIPE (2026-10-05) — /api/desk-eu, regras em functions/lib/deskEu.js.
   modo="bater"     → a recepcionista/profissional no /balcao (código "bal_…"): um botão grande "Bater entrada" /
                      "Bater saída", o relógio do turno e as horas de hoje/semana. Turno aberto há 16 h ou mais
                      = "esqueceu de bater a saída": a tela avisa e a dona acerta (nunca inventamos a hora).
   modo="relatorio" → a dona (Balcão → Equipe): horas por pessoa, por dia e por semana no fuso do negócio,
                      turnos abertos/esquecidos, CSV e "Acertar" com motivo (fica no histórico do turno). */
import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "../lib/portalApi.js";
import { tx, lang, loc, motivo, quando, partes, paraUtc, diaDe, somaDias, diaDaSemana } from "./deskApi.js";

const TZ0 = "America/New_York";

/** POST /api/desk-eu → { http, d }. Nunca lança. */
async function chamarEu(email, key, corpo) {
  try {
    const r = await fetch("/api/desk-eu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, key, lang: lang(), ...corpo }) });
    return { http: r.status, d: await r.json().catch(() => null) };
  } catch { return { http: 0, d: null }; }
}

const T = {
  in: { en: "Clock in", pt: "Bater entrada", es: "Marcar entrada" },
  out: { en: "Clock out", pt: "Bater saída", es: "Marcar salida" },
  since: { en: "On shift since", pt: "No turno desde", es: "En turno desde" },
  off: { en: "You're off the clock.", pt: "Você está fora do turno.", es: "Estás fuera de turno." },
  today: { en: "Today", pt: "Hoje", es: "Hoy" },
  week: { en: "This week", pt: "Esta semana", es: "Esta semana" },
  forgot: { en: "You forgot to clock out on", pt: "Você esqueceu de bater a saída em", es: "Olvidaste marcar la salida el" },
  forgotTail: { en: "The owner will fix it — no hours were made up.", pt: "A dona vai acertar — nenhuma hora foi inventada.", es: "La dueña lo corregirá — no se inventó ninguna hora." },
  inOk: { en: "Clocked in", pt: "Entrada registrada", es: "Entrada registrada" },
  outOk: { en: "Clocked out", pt: "Saída registrada", es: "Salida registrada" },
  changed: { en: "That was already recorded — screen updated.", pt: "Isso já estava registrado — a tela foi atualizada.", es: "Eso ya estaba registrado — pantalla actualizada." },
  readFail: { en: "Couldn't load the time clock.", pt: "Não consegui abrir o ponto.", es: "No pude abrir el reloj." },
  retry: { en: "Try again", pt: "Tentar de novo", es: "Reintentar" },
  title: { en: "Time clock", pt: "Ponto da equipe", es: "Reloj del equipo" },
  thisWeek: { en: "This week", pt: "Esta semana", es: "Esta semana" },
  lastWeek: { en: "Last week", pt: "Semana passada", es: "Semana pasada" },
  thisMonth: { en: "This month", pt: "Este mês", es: "Este mes" },
  lastMonth: { en: "Last month", pt: "Mês passado", es: "Mes pasado" },
  from: { en: "From", pt: "De", es: "Desde" },
  to: { en: "To", pt: "Até", es: "Hasta" },
  csv: { en: "Download CSV", pt: "Baixar CSV", es: "Descargar CSV" },
  person: { en: "Person", pt: "Pessoa", es: "Persona" },
  hours: { en: "Hours", pt: "Horas", es: "Horas" },
  shifts: { en: "Shifts", pt: "Turnos", es: "Turnos" },
  none: { en: "No shifts in this period.", pt: "Nenhum turno neste período.", es: "Ningún turno en este período." },
  pending: { en: "Forgot to clock out", pt: "Esqueceu de bater a saída", es: "Olvidó marcar la salida" },
  pendingHelp: { en: "Open for 16 h or more. No hours count until you fix it.", pt: "Aberto há 16 h ou mais. Não conta hora até você acertar.", es: "Abierto 16 h o más. No cuenta horas hasta que lo corrijas." },
  open: { en: "On shift now", pt: "No turno agora", es: "En turno ahora" },
  fix: { en: "Fix", pt: "Acertar", es: "Corregir" },
  fixTitle: { en: "Fix shift", pt: "Acertar turno", es: "Corregir turno" },
  in2: { en: "Clock-in", pt: "Entrada", es: "Entrada" },
  out2: { en: "Clock-out", pt: "Saída", es: "Salida" },
  reason: { en: "Reason (stays in the history)", pt: "Motivo (fica no histórico)", es: "Motivo (queda en el historial)" },
  save: { en: "Save", pt: "Salvar", es: "Guardar" },
  cancel: { en: "Cancel", pt: "Cancelar", es: "Cancelar" },
  saved: { en: "Shift fixed", pt: "Turno acertado", es: "Turno corregido" },
  fixed: { en: "fixed", pt: "acertado", es: "corregido" },
  revoked: { en: "access revoked", pt: "acesso revogado", es: "acceso revocado" },
  byDay: { en: "By day", pt: "Por dia", es: "Por día" },
  byWeek: { en: "Week of", pt: "Semana de", es: "Semana del" },
  running: { en: "running", pt: "em andamento", es: "en curso" },
  tzNote: { en: "Times in the business time zone", pt: "Horários no fuso do negócio", es: "Horarios en la zona del negocio" },
};
const ERRO = {
  reason_required: { en: "Write the reason.", pt: "Escreva o motivo.", es: "Escribe el motivo." },
  invalid_hours: { en: "Clock-out must be after clock-in.", pt: "A saída tem que ser depois da entrada.", es: "La salida debe ser después de la entrada." },
  too_long: { en: "A shift can't be longer than 24 h.", pt: "Um turno não passa de 24 h.", es: "Un turno no puede pasar de 24 h." },
  future: { en: "That time hasn't happened yet.", pt: "Esse horário ainda não chegou.", es: "Ese horario aún no llegó." },
  not_found: { en: "Shift not found.", pt: "Turno não encontrado.", es: "Turno no encontrado." },
  invalid_range: { en: "Pick up to 93 days, start before end.", pt: "Escolha até 93 dias, início antes do fim.", es: "Elige hasta 93 días, inicio antes del fin." },
};
const erro = (d, http) => (ERRO[d?.reason] ? tx(ERRO[d.reason]) : motivo(d, http));

/** minutos → "7h05" */
const hm = (m) => (m == null ? "—" : `${Math.floor(m / 60)}h${String(Math.round(m) % 60).padStart(2, "0")}`);
/** milissegundos → "2:05:09" (relógio do turno) */
const relogio = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
/** ISO → "YYYY-MM-DDTHH:MM" na parede do negócio (para o <input type="datetime-local">) e de volta. */
const paraInput = (iso, tz) => { if (!iso) return ""; const p = partes(new Date(iso), tz); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}T${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`; };
const doInput = (v, tz) => { if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v || "")) return null; const [d, h] = v.split("T"); const [hh, mm] = h.split(":").map(Number); return paraUtc(d, hh * 60 + mm, tz).toISOString(); };

export default function DeskPonto({ email, dataKey, modo = "bater" }) {
  return modo === "relatorio" ? <Relatorio email={email} dataKey={dataKey} /> : <Bater email={email} dataKey={dataKey} />;
}

// ── /balcao: bater o ponto ──────────────────────────────────────────────────────────────────────
function Bater({ email, dataKey }) {
  const [st, setSt] = useState({ fase: "lendo", d: null });
  const [seq, setSeq] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    let vivo = true;
    chamarEu(email, dataKey, { action: "ponto_status" }).then(({ d }) => {
      if (!vivo) return;
      // desvio = relógio do servidor − do aparelho (o celular pode estar adiantado); medido na chegada da resposta.
      if (d?.ok === true) setSt({ fase: "ok", d, desvio: d.agora ? Date.parse(d.agora) - Date.now() : 0 });
      else setSt((e) => ({ ...e, fase: e.d ? "ok" : "erro" }));
    });
    return () => { vivo = false; };
  }, [email, dataKey, seq]);
  useEffect(() => { const i = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { const i = setInterval(() => setSeq((n) => n + 1), 120000); return () => clearInterval(i); }, []);

  const d = st.d, tz = d?.tz || TZ0, dentro = !!d?.dentro;
  const bater = useCallback(async () => {
    setOcupado(true);
    const { http, d: r } = await chamarEu(email, dataKey, { action: "ponto_bater", esperado: dentro ? "saida" : "entrada" });
    setOcupado(false);
    if (r?.ok === true) toast(tx(r.acao === "saida" ? T.outOk : T.inOk));
    else toast(r?.reason === "state_changed" ? tx(T.changed) : erro(r, http));
    setSeq((n) => n + 1);
  }, [email, dataKey, dentro]);

  if (st.fase === "lendo") return <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />;
  if (st.fase === "erro") {
    return (
      <div className="rounded-2xl border border-g-gold/30 bg-g-gold/10 p-4 text-sm font-bold text-g-gold">
        {tx(T.readFail)} <button onClick={() => setSeq((n) => n + 1)} className="ml-2 underline">{tx(T.retry)}</button>
      </div>
    );
  }
  // O relógio corre a partir da entrada; a hora do servidor manda.
  const desvio = st.desvio || 0;
  const decorrido = dentro ? agora + desvio - Date.parse(d.aberto.entrada) : 0;
  // hoje/semana vêm do servidor já com o turno aberto até a hora da leitura; aqui só soma o que passou desde então.
  const extra = dentro && d.agora ? Math.max(0, Math.floor((agora + desvio - Date.parse(d.agora)) / 60000)) : 0;
  const ultimoEsq = (d.esquecidos || [])[0];
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-center">
        {dentro ? (
          <>
            <div className="text-xs font-bold uppercase tracking-wide text-g-muted">{tx(T.since)} {quando(d.aberto.entrada, tz, { hour: "numeric", minute: "2-digit" })}</div>
            <div className="mt-1 text-4xl font-extrabold text-g-word num">{relogio(decorrido)}</div>
          </>
        ) : <div className="text-sm font-bold text-g-muted">{tx(T.off)}</div>}
      </div>
      <button disabled={ocupado} onClick={bater}
        className={`w-full rounded-2xl px-6 py-5 min-h-[64px] text-lg font-extrabold disabled:opacity-40 ${dentro ? "border border-white/20 bg-white/[0.06] text-g-word" : "bg-g-green text-[#161512]"}`}>
        {tx(dentro ? T.out : T.in)}
      </button>
      <div className="flex justify-center gap-6 text-sm text-g-muted num">
        <span>{tx(T.today)}: <b className="text-g-word">{hm(d.hoje_min + extra)}</b></span>
        <span>{tx(T.week)}: <b className="text-g-word">{hm(d.semana_min + extra)}</b></span>
      </div>
      {ultimoEsq && (
        <div className="rounded-xl border border-g-gold/30 bg-g-gold/10 px-3 py-2 text-sm font-bold text-g-gold">
          ⚠ {tx(T.forgot)} {quando(ultimoEsq.entrada, tz, { weekday: "short", day: "numeric", month: "short" })}. {tx(T.forgotTail)}
        </div>
      )}
    </div>
  );
}

// ── Balcão → Equipe: o relatório da dona ────────────────────────────────────────────────────────
function Relatorio({ email, dataKey }) {
  const [tz, setTz] = useState(TZ0);
  const hoje = diaDe(new Date(), tz);
  const segunda = somaDias(hoje, -((diaDaSemana(hoje) + 6) % 7));
  const presets = useMemo(() => {
    const [y, m] = hoje.split("-").map(Number);
    const ini = `${y}-${String(m).padStart(2, "0")}-01`;
    const fimAnt = somaDias(ini, -1);
    return [
      { k: "thisWeek", de: segunda, ate: hoje },
      { k: "lastWeek", de: somaDias(segunda, -7), ate: somaDias(segunda, -1) },
      { k: "thisMonth", de: ini, ate: hoje },
      { k: "lastMonth", de: `${fimAnt.slice(0, 7)}-01`, ate: fimAnt },
    ];
  }, [hoje, segunda]);
  const [per, setPer] = useState({ de: segunda, ate: hoje });
  const [st, setSt] = useState({ fase: "lendo", d: null, chave: "" });
  const [seq, setSeq] = useState(0);
  const chave = `${per.de}|${per.ate}|${seq}`;          // o que está na tela é deste período? se não, "lendo"
  const lendo = st.chave !== chave;
  const [aberta, setAberta] = useState("");       // acesso_id com os dias abertos
  const [fix, setFix] = useState(null);           // turno sendo acertado

  useEffect(() => {
    let vivo = true;
    chamarEu(email, dataKey, { action: "ponto_relatorio", de: per.de, ate: per.ate }).then(({ http, d }) => {
      if (!vivo) return;
      if (d?.ok === true) {
        setSt({ fase: "ok", d, chave });
        if (d.tz && d.tz !== tz) setTz(d.tz);
      } else { setSt({ fase: "erro", d: null, msg: erro(d, http), chave }); }
    });
    return () => { vivo = false; };
  }, [email, dataKey, per.de, per.ate, seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = st.d;
  const baixar = () => {
    if (!d?.csv) return;
    const url = URL.createObjectURL(new Blob(["﻿" + d.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `ponto-${d.de}-${d.ate}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const pendentes = (d?.turnos || []).filter((t) => t.situacao === "esquecido");
  const abertos = (d?.turnos || []).filter((t) => t.situacao === "aberto");
  const doPeriodo = (d?.turnos || []).filter((t) => t.no_periodo);
  const dataCurta = (dia) => new Date(`${dia}T12:00:00Z`).toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const inp = "rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-g-word outline-none focus:border-g-green/60 [color-scheme:dark]";
  const chip = "rounded-full px-3 py-2 min-h-[40px] text-xs font-bold";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-g-word">{tx(T.title)}</h2>
          <div className="text-xs text-g-muted">{tx(T.tzNote)} · {tz}</div>
        </div>
        <button disabled={!d?.csv} onClick={baixar} className={`${chip} border border-white/15 text-g-word disabled:opacity-40`}>{tx(T.csv)}</button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {presets.map((p) => (
          <button key={p.k} onClick={() => setPer({ de: p.de, ate: p.ate })}
            className={`${chip} ${per.de === p.de && per.ate === p.ate ? "bg-g-green text-[#161512]" : "border border-white/10 text-g-word"}`}>{tx(T[p.k])}</button>
        ))}
        <label className="text-xs text-g-muted">{tx(T.from)}<br /><input type="date" value={per.de} max={per.ate} onChange={(e) => e.target.value && setPer((x) => ({ ...x, de: e.target.value }))} className={inp} /></label>
        <label className="text-xs text-g-muted">{tx(T.to)}<br /><input type="date" value={per.ate} min={per.de} onChange={(e) => e.target.value && setPer((x) => ({ ...x, ate: e.target.value }))} className={inp} /></label>
      </div>

      {!lendo && st.fase === "erro" && (
        <div className="rounded-2xl border border-g-gold/30 bg-g-gold/10 p-4 text-sm font-bold text-g-gold">
          {st.msg || tx(T.readFail)} <button onClick={() => setSeq((n) => n + 1)} className="ml-2 underline">{tx(T.retry)}</button>
        </div>
      )}
      {lendo && !d && <div className="h-32 animate-pulse rounded-2xl bg-white/[0.04]" />}

      {d && pendentes.length > 0 && (
        <div className="rounded-2xl border border-g-gold/30 bg-g-gold/10 p-4">
          <div className="text-sm font-extrabold text-g-gold">⚠ {tx(T.pending)} ({pendentes.length})</div>
          <div className="mb-2 text-xs text-g-gold/80">{tx(T.pendingHelp)}</div>
          <ul className="space-y-1.5">
            {pendentes.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm text-g-word">
                <span className="min-w-0 truncate"><b>{t.nome}</b> · {tx(T.in2)} {quando(t.entrada, d.tz)}</span>
                <button onClick={() => setFix(t)} className={`${chip} shrink-0 bg-g-green text-[#161512]`}>{tx(T.fix)}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d && abertos.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm text-g-muted">
          <b className="text-g-word">{tx(T.open)}:</b> {abertos.map((t) => `${t.nome} (${tx(T.in2).toLowerCase()} ${quando(t.entrada, d.tz, { hour: "numeric", minute: "2-digit" })})`).join(" · ")}
        </div>
      )}

      {d && (
        <div className={`overflow-hidden rounded-2xl border border-white/10 ${lendo ? "opacity-60" : ""}`}>
          {d.pessoas.filter((p) => p.turnos > 0 || p.abertos > 0).length === 0 && <div className="p-6 text-center text-sm text-g-muted">{tx(T.none)}</div>}
          {d.pessoas.filter((p) => p.turnos > 0 || p.abertos > 0).map((p) => {
            const meus = doPeriodo.filter((t) => t.acesso_id === p.acesso_id);
            const aberto = aberta === p.acesso_id;
            return (
              <div key={p.acesso_id} className="border-b border-white/10 last:border-b-0">
                <button onClick={() => setAberta(aberto ? "" : p.acesso_id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-g-word">{p.nome}{p.revogado ? <span className="ml-2 text-xs font-normal text-g-muted">({tx(T.revoked)})</span> : null}</div>
                    <div className="text-xs text-g-muted">{p.turnos} {tx(T.shifts).toLowerCase()}{p.esquecidos ? ` · ⚠ ${p.esquecidos}` : ""}</div>
                  </div>
                  <div className="shrink-0 text-xl font-extrabold text-g-word num">{hm(p.total_min)}</div>
                </button>
                {aberto && (
                  <div className="space-y-3 bg-black/10 px-4 py-3">
                    <div className="flex flex-wrap gap-2 text-xs text-g-muted num">
                      {Object.entries(p.semanas).sort().map(([s, m]) => <span key={s} className="rounded-full border border-white/10 px-2.5 py-1">{tx(T.byWeek)} {dataCurta(s)}: <b className="text-g-word">{hm(m)}</b></span>)}
                    </div>
                    <ul className="space-y-1.5">
                      {meus.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 text-g-muted num">
                            <b className="text-g-word">{dataCurta(t.dia)}</b> · {quando(t.entrada, d.tz, { hour: "numeric", minute: "2-digit" })}–{t.saida ? quando(t.saida, d.tz, { hour: "numeric", minute: "2-digit" }) : "?"}
                            {" · "}{t.situacao === "fechado" ? hm(t.minutos) : t.situacao === "aberto" ? `${hm(t.em_andamento_min)} ${tx(T.running)}` : `⚠ ${tx(T.pending).toLowerCase()}`}
                            {t.ajustes > 0 && <span title={t.motivo || ""}> · ✎ {tx(T.fixed)}</span>}
                          </span>
                          <button onClick={() => setFix(t)} className={`${chip} shrink-0 border border-white/15 text-g-word`}>{tx(T.fix)}</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {fix && d && <Acertar email={email} dataKey={dataKey} turno={fix} tz={d.tz} onFechar={(ok) => { setFix(null); if (ok) setSeq((n) => n + 1); }} />}
    </div>
  );
}

function Acertar({ email, dataKey, turno, tz, onFechar }) {
  const [ent, setEnt] = useState(() => paraInput(turno.entrada, tz));
  const [sai, setSai] = useState(() => paraInput(turno.saida, tz));
  const [mot, setMot] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const salvar = async () => {
    setOcupado(true);
    const entrada = doInput(ent, tz), saida = doInput(sai, tz);
    const { http, d } = await chamarEu(email, dataKey, { action: "ponto_corrigir", id: turno.id,
      entrada: entrada && entrada !== new Date(turno.entrada).toISOString() ? entrada : null, saida, motivo: mot });
    setOcupado(false);
    if (d?.ok === true) { toast(tx(T.saved)); onFechar(true); } else toast(erro(d, http));
  };
  const inp = "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[15px] text-g-word outline-none focus:border-g-green/60 [color-scheme:dark]";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => onFechar(false)}>
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-[#161512] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-extrabold text-g-word">{tx(T.fixTitle)} · {turno.nome}</div>
        <label className="block text-xs font-bold text-g-muted">{tx(T.in2)}<input type="datetime-local" value={ent} onChange={(e) => setEnt(e.target.value)} className={inp} /></label>
        <label className="block text-xs font-bold text-g-muted">{tx(T.out2)}<input type="datetime-local" value={sai} onChange={(e) => setSai(e.target.value)} className={inp} /></label>
        <label className="block text-xs font-bold text-g-muted">{tx(T.reason)}<input value={mot} maxLength={300} onChange={(e) => setMot(e.target.value)} className={inp} /></label>
        <div className="text-[11px] text-g-muted">{tz}</div>
        <div className="flex justify-end gap-2">
          <button onClick={() => onFechar(false)} className="rounded-full border border-white/15 px-4 py-2.5 min-h-[44px] text-sm font-bold text-g-word">{tx(T.cancel)}</button>
          <button disabled={ocupado || mot.trim().length < 3} onClick={salvar} className="rounded-full bg-g-green px-4 py-2.5 min-h-[44px] text-sm font-extrabold text-[#161512] disabled:opacity-40">{tx(T.save)}</button>
        </div>
      </div>
    </div>
  );
}
