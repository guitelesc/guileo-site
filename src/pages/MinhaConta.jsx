// /minha-conta — a ÁREA DA CLIENTE do negócio (Guileo Desk, 2026-10-05), como o app de cliente do
// MindBody/Booksy: próximos horários (remarcar/cancelar pelo link assinado de /minha-reserva), visitas,
// pacotes e vales. Sem senha:
//   /minha-conta?t=<slug ou e-mail do negócio> → a cliente digita o e-mail e recebe o link (sempre a
//     mesma resposta, seja ou não cliente — a página nunca diz quem é cliente).
//   /minha-conta?k=<token>                      → a conta (o token sai do e-mail; vale 7 dias).
// Tudo passa por /api/minha-conta. Nada aqui afirma "enviado" — só "se for cliente, enviamos".
import { useEffect, useMemo, useState } from "react";

const T = {
  en: {
    title: "My account", loading: "Loading your account…", err: "Couldn't load right now. Try again in a moment.",
    askTitle: "See your appointments", askLead: "Type the email you use with us. We'll send you a link to open your account — no password needed.",
    email: "Your email", send: "Email me the link", sending: "Sending…", badEmail: "Check the email — it doesn't look right.", tooMany: "Too many tries. Wait a few minutes and try again.",
    sent: (e) => `If ${e} is registered with us, a link is on its way. Check your inbox (and spam). The link works for 7 days.`, again: "Use another email",
    noBiz: "Open this page from the link the business shared with you.",
    expired: "This link has expired. Type your email to get a new one.", invalid: "This link isn't valid. Type your email to get a new one.", invalidNoBiz: "This link isn't valid. Ask the business for the account link.",
    notFound: "We couldn't find an account with this email here anymore.",
    hi: (n) => (n ? `Hi, ${n}` : "Hi"), signedAs: "Signed in as",
    upcoming: "Upcoming appointments", noUpcoming: "You have no upcoming appointments.", book: "Book an appointment",
    past: "Past visits", noPast: "No past visits yet.", packages: "Packages", noPackages: "You have no packages.",
    gifts: "Gift cards", noGifts: "You have no gift cards.", left: (l, t) => `${l} of ${t} sessions left`, used: "All sessions used",
    balance: (b, a) => `Balance ${b} of ${a}`, received: "Received", bought: "Bought", inactive: "Inactive",
    manage: "Reschedule / Cancel", rebook: "Book again", with: "with", deposit: "Deposit paid", ref: "Confirmation",
    status: { booked: "Booked", confirmed: "Confirmed", in_progress: "Checked in", completed: "Completed", no_show: "Missed", hold: "Pending" },
    places: "Where we are", call: "Call", linkUntil: (d) => `This link works until ${d}.`,
  },
  pt: {
    title: "Minha conta", loading: "Carregando sua conta…", err: "Não carregou agora. Tente de novo em instantes.",
    askTitle: "Veja seus horários", askLead: "Digite o e-mail que você usa com a gente. Mandamos um link para abrir sua conta — sem senha.",
    email: "Seu e-mail", send: "Me mande o link", sending: "Enviando…", badEmail: "Confira o e-mail — parece que falta algo.", tooMany: "Muitas tentativas. Espere alguns minutos e tente de novo.",
    sent: (e) => `Se ${e} estiver cadastrado aqui, o link está a caminho. Confira sua caixa de entrada (e o spam). O link vale por 7 dias.`, again: "Usar outro e-mail",
    noBiz: "Abra esta página pelo link que o estabelecimento te mandou.",
    expired: "Este link venceu. Digite seu e-mail para receber outro.", invalid: "Este link não é válido. Digite seu e-mail para receber outro.", invalidNoBiz: "Este link não é válido. Peça ao estabelecimento o link da conta.",
    notFound: "Não encontramos mais uma conta com este e-mail aqui.",
    hi: (n) => (n ? `Oi, ${n}` : "Oi"), signedAs: "Conta de",
    upcoming: "Próximos horários", noUpcoming: "Você não tem horário marcado.", book: "Marcar horário",
    past: "Visitas anteriores", noPast: "Ainda não há visitas anteriores.", packages: "Pacotes", noPackages: "Você não tem pacotes.",
    gifts: "Vales-presente", noGifts: "Você não tem vales-presente.", left: (l, t) => `${l} de ${t} sessões restantes`, used: "Todas as sessões usadas",
    balance: (b, a) => `Saldo ${b} de ${a}`, received: "Recebido", bought: "Comprado", inactive: "Inativo",
    manage: "Remarcar / Cancelar", rebook: "Marcar de novo", with: "com", deposit: "Sinal pago", ref: "Confirmação",
    status: { booked: "Agendado", confirmed: "Confirmado", in_progress: "Em atendimento", completed: "Concluído", no_show: "Faltou", hold: "Pendente" },
    places: "Onde estamos", call: "Ligar", linkUntil: (d) => `Este link vale até ${d}.`,
  },
  es: {
    title: "Mi cuenta", loading: "Cargando su cuenta…", err: "No cargó ahora. Inténtelo en un momento.",
    askTitle: "Vea sus citas", askLead: "Escriba el correo que usa con nosotros. Le enviamos un enlace para abrir su cuenta — sin contraseña.",
    email: "Su correo", send: "Envíenme el enlace", sending: "Enviando…", badEmail: "Revise el correo — parece que falta algo.", tooMany: "Demasiados intentos. Espere unos minutos e inténtelo de nuevo.",
    sent: (e) => `Si ${e} está registrado aquí, el enlace va en camino. Revise su bandeja de entrada (y el spam). El enlace vale 7 días.`, again: "Usar otro correo",
    noBiz: "Abra esta página desde el enlace que le envió el negocio.",
    expired: "Este enlace venció. Escriba su correo para recibir otro.", invalid: "Este enlace no es válido. Escriba su correo para recibir otro.", invalidNoBiz: "Este enlace no es válido. Pida al negocio el enlace de la cuenta.",
    notFound: "Ya no encontramos una cuenta con este correo aquí.",
    hi: (n) => (n ? `Hola, ${n}` : "Hola"), signedAs: "Cuenta de",
    upcoming: "Próximas citas", noUpcoming: "No tiene citas programadas.", book: "Reservar cita",
    past: "Visitas anteriores", noPast: "Aún no hay visitas anteriores.", packages: "Paquetes", noPackages: "No tiene paquetes.",
    gifts: "Tarjetas de regalo", noGifts: "No tiene tarjetas de regalo.", left: (l, t) => `${l} de ${t} sesiones restantes`, used: "Todas las sesiones usadas",
    balance: (b, a) => `Saldo ${b} de ${a}`, received: "Recibida", bought: "Comprada", inactive: "Inactiva",
    manage: "Reprogramar / Cancelar", rebook: "Reservar de nuevo", with: "con", deposit: "Depósito pagado", ref: "Confirmación",
    status: { booked: "Reservada", confirmed: "Confirmada", in_progress: "En atención", completed: "Terminada", no_show: "No asistió", hold: "Pendiente" },
    places: "Dónde estamos", call: "Llamar", linkUntil: (d) => `Este enlace vale hasta ${d}.`,
  },
};
const LOC = { en: "en-US", pt: "pt-BR", es: "es-ES" };
const C = { bg: "#F7F4EE", card: "#FFFFFF", ink: "#2B2722", muted: "#6B645A", line: "#E7E1D6", accent: "#5E7A65", soft: "#E3ECE5", warn: "#9B3D2E", warnSoft: "#F3E1DC" };
const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 20 };
const btn = { display: "block", width: "100%", boxSizing: "border-box", padding: "14px 18px", borderRadius: 14, border: "none", background: C.accent, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", textAlign: "center", textDecoration: "none" };
const ghost = { ...btn, background: "transparent", color: C.ink, border: `1px solid ${C.line}` };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// O Desk atende negócio dos EUA (USD); fuso do Brasil → real. Sem moeda no cadastro, é o melhor sinal.
const moedaDo = (tz) => (/^America\/(Sao_Paulo|Fortaleza|Recife|Bahia|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Maceio|Araguaina|Santarem|Noronha)$/.test(tz || "") ? "BRL" : "USD");

const Titulo = ({ children }) => <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: C.muted, margin: "26px 4px 10px" }}>{children}</div>;
const Vazio = ({ children }) => <div style={{ ...card, color: C.muted, fontSize: 15 }}>{children}</div>;
const Selo = ({ st, label }) => (label ? <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: st === "no_show" ? C.warnSoft : C.soft, color: st === "no_show" ? C.warn : C.accent }}>{label}</span> : null);

export default function MinhaConta() {
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const lang = useMemo(() => { const l = (q.get("lang") || navigator.language || "en").slice(0, 2).toLowerCase(); return ["pt", "es"].includes(l) ? l : "en"; }, [q]);
  const t = T[lang];
  const k = q.get("k") || "";
  const [negocio, setNegocio] = useState(q.get("t") || "");   // slug ou e-mail do negócio (para pedir o link)
  const [fase, setFase] = useState(k ? "lendo" : "pedir");    // lendo | ok | pedir | erro | nao_achou
  const [aviso, setAviso] = useState("");                      // por que caiu no "pedir" (venceu / inválido)
  const [d, setD] = useState(null);
  const [email, setEmail] = useState("");
  const [envio, setEnvio] = useState({ estado: "", msg: "" }); // "" | enviando | feito | erro

  const post = async (corpo) => {
    try {
      const res = await fetch("/api/minha-conta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      return { http: res.status, j: await res.json().catch(() => null) };
    } catch { return { http: 0, j: null }; }
  };

  useEffect(() => { try { document.title = t.title; } catch { /* */ } }, [t]);
  useEffect(() => {
    if (!k) return undefined;
    let vivo = true;
    post({ action: "ver", k }).then(({ http, j }) => {
      if (!vivo) return;
      if (http === 200 && j?.ok) {
        setD(j); setFase("ok");
        try { document.title = `${j.business?.name ? j.business.name + " · " : ""}${t.title}`; } catch { /* */ }
        return;
      }
      if (j?.t) setNegocio(j.t);
      if (http === 401) { setAviso(j?.error === "expired" ? "expired" : "invalid"); setFase("pedir"); return; }
      if (http === 404) { setFase("nao_achou"); return; }
      setFase("erro");
    });
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pedir = async (e) => {
    e.preventDefault();
    const m = email.trim();
    if (!EMAIL.test(m)) { setEnvio({ estado: "erro", msg: t.badEmail }); return; }
    setEnvio({ estado: "enviando", msg: "" });
    const { http, j } = await post({ action: "pedir", t: negocio, email: m, lang });
    if (http === 200 && j?.ok) setEnvio({ estado: "feito", msg: t.sent(m) });
    else if (http === 429) setEnvio({ estado: "erro", msg: t.tooMany });
    else if (http === 400 && j?.error === "bad_email") setEnvio({ estado: "erro", msg: t.badEmail });
    else setEnvio({ estado: "erro", msg: t.err });
  };

  const quando = (iso, tz) => new Date(iso).toLocaleString(LOC[lang], { timeZone: tz || "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const dia = (iso, tz) => new Date(iso).toLocaleDateString(LOC[lang], { timeZone: tz || "America/New_York", day: "numeric", month: "short", year: "numeric" });
  const tzBase = d?.business?.locations?.[0]?.tz || d?.upcoming?.[0]?.tz || "America/New_York";
  const dinheiro = (cents) => { try { return new Intl.NumberFormat(LOC[lang], { style: "currency", currency: moedaDo(tzBase) }).format((Number(cents) || 0) / 100); } catch { return String((Number(cents) || 0) / 100); } };

  let corpo;
  if (fase === "lendo") corpo = <div style={{ ...card, color: C.muted, textAlign: "center" }}>{t.loading}</div>;
  else if (fase === "erro") corpo = <div style={{ ...card, color: C.muted, textAlign: "center" }}>{t.err}</div>;
  else if (fase === "nao_achou") corpo = <div style={{ ...card, color: C.muted, textAlign: "center" }}>{t.notFound}</div>;
  else if (fase === "pedir") {
    if (!negocio) corpo = <div style={{ ...card, color: C.muted, textAlign: "center" }}>{aviso ? t.invalidNoBiz : t.noBiz}</div>;
    else if (envio.estado === "feito") {
      corpo = (
        <div style={card}>
          <div role="status" style={{ fontSize: 16, lineHeight: 1.6 }}>{envio.msg}</div>
          <button onClick={() => { setEnvio({ estado: "", msg: "" }); setEmail(""); }} style={{ ...ghost, marginTop: 16 }}>{t.again}</button>
        </div>
      );
    } else {
      corpo = (
        <form onSubmit={pedir} style={card} noValidate>
          {aviso && <div role="alert" style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 12, background: C.warnSoft, color: C.warn, fontSize: 14 }}>{aviso === "expired" ? t.expired : t.invalid}</div>}
          <div style={{ fontSize: 18, fontWeight: 600 }}>{t.askTitle}</div>
          <div style={{ color: C.muted, fontSize: 15, lineHeight: 1.6, margin: "6px 0 16px" }}>{t.askLead}</div>
          <label htmlFor="mc-email" style={{ display: "block", fontSize: 13, color: C.muted, marginBottom: 6 }}>{t.email}</label>
          <input id="mc-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "14px 14px", fontSize: 16, borderRadius: 12, border: `1px solid ${C.line}`, background: "#fff", color: C.ink }} />
          <button type="submit" disabled={envio.estado === "enviando"} style={{ ...btn, marginTop: 14, opacity: envio.estado === "enviando" ? 0.6 : 1 }}>{envio.estado === "enviando" ? t.sending : t.send}</button>
          {envio.estado === "erro" && <div role="alert" style={{ marginTop: 12, color: C.warn, fontSize: 14 }}>{envio.msg}</div>}
        </form>
      );
    }
  } else {
    const b = d.business || {};
    corpo = (
      <>
        <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{t.hi(d.name)}</div>
            <div style={{ color: C.muted, fontSize: 13, overflowWrap: "anywhere" }}>{t.signedAs} {d.email}</div>
          </div>
          {b.book_url ? <a href={b.book_url} style={{ ...btn, width: "auto", padding: "11px 16px", fontSize: 15 }}>{t.book}</a> : null}
        </div>

        <Titulo>{t.upcoming}</Titulo>
        {!d.upcoming.length ? <Vazio>{t.noUpcoming}</Vazio> : (
          <div style={{ display: "grid", gap: 10 }}>
            {d.upcoming.map((a) => (
              <div key={a.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>{a.service || "—"}</div>
                  <Selo st={a.status} label={t.status[a.status]} />
                </div>
                <div style={{ marginTop: 6, fontSize: 15 }}>{quando(a.start, a.tz)}</div>
                <div style={{ color: C.muted, fontSize: 14, marginTop: 2 }}>{[a.pro ? `${t.with} ${a.pro}` : "", a.location].filter(Boolean).join(" · ")}</div>
                {a.address ? <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{a.address}</div> : null}
                <div style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>{[a.ref ? `${t.ref} ${a.ref}` : "", a.deposit_paid ? `✓ ${t.deposit}` : ""].filter(Boolean).join(" · ")}</div>
                {a.manage_url ? <a href={a.manage_url} style={{ ...ghost, marginTop: 12 }}>{t.manage}</a> : null}
              </div>
            ))}
          </div>
        )}

        <Titulo>{t.packages}</Titulo>
        {!d.packages.length ? <Vazio>{t.noPackages}</Vazio> : (
          <div style={{ ...card, padding: "6px 20px" }}>
            {d.packages.map((p, i) => (
              <div key={i} style={{ padding: "12px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <div style={{ fontWeight: 600 }}>{p.name || p.service || "—"}</div>
                <div style={{ color: p.left > 0 ? C.accent : C.muted, fontSize: 14, marginTop: 2 }}>{p.left > 0 ? t.left(p.left, p.total) : t.used}</div>
              </div>
            ))}
          </div>
        )}

        <Titulo>{t.gifts}</Titulo>
        {!d.gift_cards.length ? <Vazio>{t.noGifts}</Vazio> : (
          <div style={{ ...card, padding: "6px 20px" }}>
            {d.gift_cards.map((g, i) => (
              <div key={i} style={{ padding: "12px 0", borderTop: i ? `1px solid ${C.line}` : "none", display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>•••• {g.last4}</div>
                  <div style={{ color: C.muted, fontSize: 13 }}>{g.role === "received" ? t.received : t.bought}{g.active ? "" : ` · ${t.inactive}`}</div>
                </div>
                <div style={{ fontSize: 14, textAlign: "right", color: g.active && g.balance_cents > 0 ? C.ink : C.muted }}>{t.balance(dinheiro(g.balance_cents), dinheiro(g.amount_cents))}</div>
              </div>
            ))}
          </div>
        )}

        <Titulo>{t.past}</Titulo>
        {!d.past.length ? <Vazio>{t.noPast}</Vazio> : (
          <div style={{ ...card, padding: "6px 20px" }}>
            {d.past.map((a, i) => (
              <div key={a.id} style={{ padding: "12px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{a.service || "—"}</div>
                    <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{[dia(a.start, a.tz), a.pro ? `${t.with} ${a.pro}` : ""].filter(Boolean).join(" · ")}</div>
                  </div>
                  {["completed", "no_show"].includes(a.status) ? <Selo st={a.status} label={t.status[a.status]} /> : null}
                </div>
                {a.rebook_url ? <a href={a.rebook_url} style={{ ...ghost, marginTop: 10, padding: "10px 14px", fontSize: 15 }}>{t.rebook}</a> : null}
              </div>
            ))}
          </div>
        )}

        {b.locations?.length ? (
          <>
            <Titulo>{t.places}</Titulo>
            <div style={{ ...card, padding: "6px 20px" }}>
              {b.locations.map((l, i) => (
                <div key={i} style={{ padding: "12px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                  <div style={{ fontWeight: 600 }}>{l.name}</div>
                  {l.address ? <div style={{ color: C.muted, fontSize: 14 }}>{l.address}</div> : null}
                  {l.phone ? <a href={`tel:${l.phone}`} style={{ color: C.accent, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>{t.call} · {l.phone}</a> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}
        {d.expires_at ? <div style={{ color: C.muted, fontSize: 12, textAlign: "center", marginTop: 22 }}>{t.linkUntil(dia(d.expires_at, tzBase))}</div> : null}
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "Inter, 'Segoe UI', Helvetica, Arial, sans-serif", padding: "36px 16px 48px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 28, marginBottom: 4, overflowWrap: "anywhere" }}>{d?.business?.name || ""}</div>
        <div style={{ color: C.muted, marginBottom: 20 }}>{t.title}</div>
        {corpo}
      </div>
    </div>
  );
}
