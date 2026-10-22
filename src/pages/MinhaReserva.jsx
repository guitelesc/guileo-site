// /minha-reserva?t=&a=&s= — a CLIENTE do negócio vê, remarca ou cancela a própria reserva (2026-10-05).
// Abre pelo link assinado do e-mail de confirmação. Tudo passa por /api/reserva, que confere a
// assinatura e a política de cancelamento. Nunca diz "remarcado"/"cancelado" sem o servidor confirmar.
import { useEffect, useMemo, useState } from "react";

const T = {
  en: { title: "Your appointment", loading: "Loading your appointment…", invalid: "This link isn't valid anymore. Please contact the business.", err: "Couldn't load right now. Try again in a moment.",
    service: "Service", when: "When", with: "With", where: "Where", ref: "Confirmation", status: { booked: "Booked", confirmed: "Confirmed", in_progress: "Checked in", completed: "Completed", cancelled: "Cancelled", no_show: "Missed" },
    reschedule: "Reschedule", cancel: "Cancel appointment", cancelAsk: "Cancel this appointment?", yes: "Yes, cancel", keep: "Keep it", pick: "Pick a new time", noSlots: "No other times available in the next 3 weeks. Please call us.",
    confirmNew: "Move to this time", back: "‹ Back", moved: "Done — your appointment was moved to", cancelled: "Your appointment was cancelled.", call: "Call us",
    why: { inside_window: (h) => `Changes less than ${h} hours before the appointment are made by phone.`, past: "This appointment already happened.", cancelled: "This appointment was cancelled.", not_found: "We couldn't find this appointment." }, failed: "That time was just taken — pick another one.", deposit: "Deposit paid" },
  pt: { title: "Seu horário", loading: "Carregando seu horário…", invalid: "Este link não vale mais. Fale com o estabelecimento.", err: "Não carregou agora. Tente de novo em instantes.",
    service: "Serviço", when: "Quando", with: "Com", where: "Onde", ref: "Confirmação", status: { booked: "Agendado", confirmed: "Confirmado", in_progress: "Em atendimento", completed: "Concluído", cancelled: "Cancelado", no_show: "Faltou" },
    reschedule: "Remarcar", cancel: "Cancelar horário", cancelAsk: "Cancelar este horário?", yes: "Sim, cancelar", keep: "Manter", pick: "Escolha o novo horário", noSlots: "Não há outros horários nas próximas 3 semanas. Ligue para nós.",
    confirmNew: "Mudar para este horário", back: "‹ Voltar", moved: "Pronto — seu horário mudou para", cancelled: "Seu horário foi cancelado.", call: "Ligar",
    why: { inside_window: (h) => `Mudanças com menos de ${h} horas de antecedência são feitas por telefone.`, past: "Este horário já passou.", cancelled: "Este horário foi cancelado.", not_found: "Não encontramos este horário." }, failed: "Esse horário acabou de ser ocupado — escolha outro.", deposit: "Sinal pago" },
  es: { title: "Su cita", loading: "Cargando su cita…", invalid: "Este enlace ya no es válido. Comuníquese con el negocio.", err: "No cargó ahora. Inténtelo en un momento.",
    service: "Servicio", when: "Cuándo", with: "Con", where: "Dónde", ref: "Confirmación", status: { booked: "Reservada", confirmed: "Confirmada", in_progress: "En atención", completed: "Terminada", cancelled: "Cancelada", no_show: "No asistió" },
    reschedule: "Reprogramar", cancel: "Cancelar cita", cancelAsk: "¿Cancelar esta cita?", yes: "Sí, cancelar", keep: "Mantener", pick: "Elija el nuevo horario", noSlots: "No hay otros horarios en las próximas 3 semanas. Llámenos.",
    confirmNew: "Cambiar a este horario", back: "‹ Volver", moved: "Listo — su cita cambió a", cancelled: "Su cita fue cancelada.", call: "Llamar",
    why: { inside_window: (h) => `Los cambios con menos de ${h} horas de anticipación se hacen por teléfono.`, past: "Esta cita ya pasó.", cancelled: "Esta cita fue cancelada.", not_found: "No encontramos esta cita." }, failed: "Ese horario se acaba de ocupar — elija otro.", deposit: "Depósito pagado" },
};
const LOC = { en: "en-US", pt: "pt-BR", es: "es-ES" };
const C = { bg: "#F7F4EE", card: "#FFFFFF", ink: "#2B2722", muted: "#6B645A", line: "#E7E1D6", accent: "#5E7A65" };
const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 22 };
const btn = { width: "100%", padding: "14px 18px", borderRadius: 14, border: "none", background: C.accent, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" };
const ghost = { ...btn, background: "transparent", color: C.ink, border: `1px solid ${C.line}` };

export default function MinhaReserva() {
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const lang = useMemo(() => { const l = (q.get("lang") || navigator.language || "en").slice(0, 2).toLowerCase(); return ["pt", "es"].includes(l) ? l : "en"; }, [q]);
  const t = T[lang];
  const base = { t: q.get("t") || "", a: q.get("a") || "", s: q.get("s") || "" };
  const [fase, setFase] = useState("lendo");   // lendo | ok | invalido | erro
  const [r, setR] = useState(null);
  const [modo, setModo] = useState("ver");     // ver | remarcar | cancelar | feito
  const [vagas, setVagas] = useState({ dias: [], dia: "", slots: [], lendo: false });
  const [esc, setEsc] = useState("");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const post = async (corpo) => {
    try {
      const res = await fetch("/api/reserva", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...base, ...corpo }) });
      return { http: res.status, d: await res.json().catch(() => null) };
    } catch { return { http: 0, d: null }; }
  };
  useEffect(() => {
    let vivo = true;
    post({ action: "get" }).then(({ http, d }) => {
      if (!vivo) return;
      if (http === 401 || http === 404) { setFase("invalido"); return; }
      if (d?.ok) { setR(d); setFase("ok"); try { document.title = `${d.business || ""} · ${t.title}`; } catch { /* */ } } else setFase("erro");
    });
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tz = r?.tz || "America/New_York";
  const quando = (iso) => new Date(iso).toLocaleString(LOC[lang], { timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const hora = (iso) => new Date(iso).toLocaleTimeString(LOC[lang], { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const lerVagas = async (dia) => {
    setVagas((v) => ({ ...v, lendo: true })); setEsc("");
    const { d } = await post({ action: "slots", ...(dia ? { dia } : {}) });
    setVagas(d?.ok ? { dias: d.dias || [], dia: d.dia || "", slots: d.slots || [], lendo: false } : { dias: [], dia: "", slots: [], lendo: false });
  };
  const remarcar = async () => {
    setOcupado(true); setMsg("");
    const { d } = await post({ action: "reschedule", start: esc });
    setOcupado(false);
    if (d?.ok) { setR({ ...r, start: d.start }); setModo("feito"); setMsg(`${t.moved} ${quando(d.start)}.`); }
    else { setMsg(t.failed); lerVagas(vagas.dia); }
  };
  const cancelar = async () => {
    setOcupado(true); setMsg("");
    const { d } = await post({ action: "cancel" });
    setOcupado(false);
    if (d?.ok) { setR({ ...r, status: "cancelled", pode_mudar: false }); setModo("feito"); setMsg(t.cancelled); }
    else setMsg(d?.error && t.why[d.error] ? (typeof t.why[d.error] === "function" ? t.why[d.error](r?.cancel_window_h) : t.why[d.error]) : t.err);
  };

  const Linha = ({ k, v }) => (v ? <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderBottom: `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span></div> : null);
  const ligar = r?.phone ? <a href={`tel:${r.phone}`} style={{ ...ghost, display: "block", textAlign: "center", textDecoration: "none", marginTop: 10 }}>{t.call} · {r.phone}</a> : null;

  let corpo;
  if (fase === "lendo") corpo = <div style={{ ...card, color: C.muted, textAlign: "center" }}>{t.loading}</div>;
  else if (fase === "invalido") corpo = <div style={{ ...card, color: C.muted, textAlign: "center" }}>{t.invalid}</div>;
  else if (fase === "erro") corpo = <div style={{ ...card, color: C.muted, textAlign: "center" }}>{t.err}</div>;
  else if (modo === "remarcar") {
    corpo = (
      <div style={card}>
        <button onClick={() => setModo("ver")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 0, marginBottom: 10 }}>{t.back}</button>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>{t.pick}</div>
        {vagas.lendo ? <div style={{ color: C.muted }}>{t.loading}</div> : !vagas.dias.length ? <div style={{ color: C.muted }}>{t.noSlots}{ligar}</div> : (
          <>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10 }}>
              {vagas.dias.slice(0, 21).map((d) => {
                const on = d === vagas.dia; const dt = new Date(`${d}T12:00:00Z`);
                return <button key={d} onClick={() => lerVagas(d)} style={{ flex: "0 0 auto", width: 58, padding: "10px 0", borderRadius: 14, border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accent : C.card, color: on ? "#fff" : C.ink, cursor: "pointer" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase" }}>{dt.toLocaleDateString(LOC[lang], { weekday: "short", timeZone: "UTC" }).replace(".", "")}</div>
                  <div style={{ fontSize: 19, fontWeight: 600 }}>{dt.getUTCDate()}</div></button>;
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8 }}>
              {vagas.slots.map((s) => <button key={s.start} onClick={() => setEsc(s.start)} style={{ padding: "12px 6px", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", border: `1px solid ${esc === s.start ? C.accent : C.line}`, background: esc === s.start ? C.accent : C.card, color: esc === s.start ? "#fff" : C.ink }}>{hora(s.start)}</button>)}
            </div>
            <button disabled={!esc || ocupado} onClick={remarcar} style={{ ...btn, marginTop: 16, opacity: !esc || ocupado ? 0.5 : 1 }}>{t.confirmNew}</button>
          </>
        )}
        {msg && <div role="alert" style={{ marginTop: 12, color: "#9B3D2E", fontSize: 14 }}>{msg}</div>}
      </div>
    );
  } else {
    const st = r.status;
    corpo = (
      <div style={card}>
        <div style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: st === "cancelled" ? "#F3E1DC" : "#E3ECE5", color: st === "cancelled" ? "#9B3D2E" : C.accent, marginBottom: 12 }}>{t.status[st] || st}</div>
        <Linha k={t.service} v={r.service} />
        <Linha k={t.when} v={quando(r.start)} />
        <Linha k={t.with} v={r.pro} />
        <Linha k={t.where} v={[r.location, r.address].filter(Boolean).join(" · ")} />
        <Linha k={t.ref} v={r.ref} />
        {r.deposit_paid ? <Linha k={t.deposit} v="✓" /> : null}
        {msg && <div style={{ marginTop: 14, fontSize: 15, fontWeight: 600, color: modo === "feito" ? C.accent : "#9B3D2E" }}>{msg}</div>}
        {modo === "cancelar" ? (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>{t.cancelAsk}</div>
            <button disabled={ocupado} onClick={cancelar} style={{ ...btn, background: "#9B3D2E" }}>{t.yes}</button>
            <button onClick={() => setModo("ver")} style={{ ...ghost, marginTop: 8 }}>{t.keep}</button>
          </div>
        ) : modo !== "feito" && r.pode_mudar ? (
          <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
            <button onClick={() => { setModo("remarcar"); lerVagas(""); }} style={btn}>{t.reschedule}</button>
            <button onClick={() => setModo("cancelar")} style={ghost}>{t.cancel}</button>
          </div>
        ) : !r.pode_mudar && r.motivo && modo !== "feito" ? (
          <div style={{ marginTop: 16, color: C.muted, fontSize: 14 }}>{typeof t.why[r.motivo] === "function" ? t.why[r.motivo](r.cancel_window_h) : t.why[r.motivo]}{ligar}</div>
        ) : null}
      </div>
    );
  }
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "Inter, 'Segoe UI', Helvetica, Arial, sans-serif", padding: "40px 16px" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 28, marginBottom: 4 }}>{r?.business || ""}</div>
        <div style={{ color: C.muted, marginBottom: 20 }}>{t.title}</div>
        {corpo}
      </div>
    </div>
  );
}
