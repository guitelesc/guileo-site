/* GUILEO DESK — COBRAR ONLINE no Stripe DO NEGÓCIO (2026-10-05). Fica dentro do Caixa (DeskCaixa.jsx).
   Três ações, todas em /api/desk-pagamentos (lib/stripeDoNegocio.js):
     · Salvar cartão     → link do Stripe (mode=setup) para a recepção copiar e mandar à cliente.
     · Cobrar taxa de falta → só em agendamento marcado como FALTA; cobra o cartão salvo; valor do cadastro.
     · Vender assinatura → link do Stripe (mode=subscription) de uma assinatura cadastrada em Receita recorrente.
     · Taxa de cancelamento em cima da hora (v6) → só em agendamento CANCELADO: mostra quando e quem cancelou
       ("cancelou 5 h antes · pelo balcão") e, se caiu dentro da janela do serviço, cobra o cartão salvo.
       O valor é a MESMA taxa de falta do serviço (o cadastro não tem campo próprio) — a tela diz isso.

   🚨 HONESTIDADE
   · Sem o Stripe do negócio ligado (guileoai.com/receber) os botões ficam apagados e a tela diz por quê.
   · "Cobrada" só com d.ok === true (PaymentIntent succeeded). Recusa mostra a frase do banco; chave sem
     permissão mostra o NOME da permissão que falta.
   · O link é para COPIAR — não há modelo de texto/e-mail para ele, então a tela não diz "enviado".
   · Cartão salvo só aparece depois que o Stripe confirma (volta da cliente ou conferência de hora em hora).
   · Fora de conta conectada (amostra), nada é chamado. */
import { useState, useEffect, useCallback } from "react";
import { toast } from "../lib/portalApi.js";
import { motivo, dinheiro, tx, lang, quando } from "./deskApi.js";

const T = {
  title: { en: "Online payments (your Stripe)", pt: "Pagamento online (seu Stripe)", es: "Pagos en línea (tu Stripe)", hi: "ऑनलाइन भुगतान (आपका Stripe)" },
  notConnected: { en: "Connect your Stripe at guileoai.com/receber to save cards, charge no-show fees and sell memberships.", pt: "Conecte o seu Stripe em guileoai.com/receber para salvar cartão, cobrar taxa de falta e vender assinatura.", es: "Conecta tu Stripe en guileoai.com/receber para guardar tarjetas, cobrar inasistencias y vender membresías.", hi: "कार्ड सेव करने, नो-शो शुल्क और मेंबरशिप के लिए guileoai.com/receber पर Stripe जोड़ें।" },
  sample: { en: "Sample — connect your account to use online payments.", pt: "Amostra — conecte a sua conta para usar o pagamento online.", es: "Muestra — conecta tu cuenta para usar pagos en línea.", hi: "नमूना — ऑनलाइन भुगतान के लिए खाता जोड़ें।" },
  needContact: { en: "Type the client's phone or email above to see her saved card.", pt: "Digite acima o telefone ou e-mail da cliente para ver o cartão salvo.", es: "Escribe arriba el teléfono o correo de la clienta para ver su tarjeta.", hi: "सेव कार्ड देखने के लिए ऊपर ग्राहक का फ़ोन या ईमेल लिखें।" },
  reading: { en: "Checking saved card…", pt: "Conferindo cartão salvo…", es: "Revisando tarjeta guardada…", hi: "सेव कार्ड देख रहे हैं…" },
  readFail: { en: "Couldn't check the saved card.", pt: "Não consegui conferir o cartão salvo.", es: "No pude revisar la tarjeta guardada.", hi: "सेव कार्ड नहीं देख पाया।" },
  saved: { en: "Saved card", pt: "Cartão salvo", es: "Tarjeta guardada", hi: "सेव कार्ड" },
  noCard: { en: "No saved card.", pt: "Nenhum cartão salvo.", es: "Sin tarjeta guardada.", hi: "कोई सेव कार्ड नहीं।" },
  otherMode: { en: "Saved with a test key — it can't be charged with the current key.", pt: "Salvo com chave de teste — não dá para cobrar com a chave atual.", es: "Guardada con clave de prueba — no se puede cobrar con la clave actual.", hi: "टेस्ट key से सेव — मौजूदा key से चार्ज नहीं हो सकता।" },
  testMode: { en: "TEST mode", pt: "modo TESTE", es: "modo PRUEBA", hi: "टेस्ट मोड" },
  saveCard: { en: "Save card", pt: "Salvar cartão", es: "Guardar tarjeta", hi: "कार्ड सेव करें" },
  chargeFee: { en: "Charge no-show fee", pt: "Cobrar taxa de falta", es: "Cobrar inasistencia", hi: "नो-शो शुल्क लें" },
  sellMembership: { en: "Sell membership", pt: "Vender assinatura", es: "Vender membresía", hi: "मेंबरशिप बेचें" },
  working: { en: "Working…", pt: "Aguarde…", es: "Un momento…", hi: "रुकिए…" },
  linkReady: { en: "Link ready — copy it and send it to the client. It expires in 23 hours.", pt: "Link pronto — copie e mande para a cliente. Vale 23 horas.", es: "Enlace listo — cópialo y envíalo a la clienta. Vence en 23 horas.", hi: "लिंक तैयार — कॉपी करके ग्राहक को भेजें। 23 घंटे में समाप्त।" },
  linkCard: { en: "When she finishes, the card shows up here.", pt: "Quando ela terminar, o cartão aparece aqui.", es: "Cuando termine, la tarjeta aparece aquí.", hi: "पूरा होने पर कार्ड यहाँ दिखेगा।" },
  linkMember: { en: "When she pays, the membership is recorded for her.", pt: "Quando ela pagar, a assinatura fica registrada para ela.", es: "Cuando pague, la membresía queda registrada.", hi: "भुगतान होने पर मेंबरशिप दर्ज होगी।" },
  copy: { en: "Copy", pt: "Copiar", es: "Copiar", hi: "कॉपी करें" },
  copied: { en: "Copied", pt: "Copiado", es: "Copiado", hi: "कॉपी हुआ" },
  check: { en: "Check again", pt: "Conferir de novo", es: "Revisar de nuevo", hi: "फिर देखें" },
  confirmFee: { en: "Charge the no-show fee of {v} to {c}?", pt: "Cobrar a taxa de falta de {v} no {c}?", es: "¿Cobrar el cargo por inasistencia de {v} a {c}?", hi: "{c} पर {v} का नो-शो शुल्क लें?" },
  feeCharged: { en: "No-show fee charged", pt: "Taxa de falta cobrada", es: "Cargo por inasistencia cobrado", hi: "नो-शो शुल्क लिया गया" },
  feeAlready: { en: "This no-show fee had already been charged — nothing was charged twice.", pt: "Esta taxa de falta já tinha sido cobrada — nada foi cobrado duas vezes.", es: "Este cargo ya se había cobrado — no se cobró dos veces.", hi: "यह शुल्क पहले ही लिया जा चुका था — दो बार नहीं लिया गया।" },
  feeOnlyNoShow: { en: "The no-show fee appears when the appointment is marked as no-show.", pt: "A taxa de falta aparece quando o agendamento está marcado como falta.", es: "El cargo aparece cuando la cita está marcada como inasistencia.", hi: "नो-शो शुल्क तब दिखता है जब अपॉइंटमेंट नो-शो हो।" },
  noMemberships: { en: "No memberships yet — create one under Recurring revenue.", pt: "Nenhuma assinatura cadastrada — crie em Receita recorrente.", es: "Aún no hay membresías — crea una en Ingresos recurrentes.", hi: "कोई मेंबरशिप नहीं — Recurring revenue में बनाएँ।" },
  pickMembership: { en: "Choose a membership…", pt: "Escolha a assinatura…", es: "Elige la membresía…", hi: "मेंबरशिप चुनें…" },
  makeLink: { en: "Create link", pt: "Gerar link", es: "Crear enlace", hi: "लिंक बनाएँ" },
  month: { en: "/mo", pt: "/mês", es: "/mes", hi: "/माह" },
  year: { en: "/yr", pt: "/ano", es: "/año", hi: "/वर्ष" },
  members: { en: "active", pt: "ativas", es: "activas", hi: "सक्रिय" },
  // cancelamento em cima da hora (v6)
  cancelReading: { en: "Checking when it was cancelled…", pt: "Conferindo quando foi cancelado…", es: "Revisando cuándo se canceló…", hi: "देख रहे हैं कब रद्द हुआ…" },
  cancelledH: { en: "Cancelled {h} before the appointment", pt: "Cancelou {h} antes do horário", es: "Canceló {h} antes de la cita", hi: "अपॉइंटमेंट से {h} पहले रद्द" },
  cancelledAfter: { en: "Cancelled after the appointment time", pt: "Cancelou depois do horário marcado", es: "Canceló después de la hora de la cita", hi: "समय निकलने के बाद रद्द" },
  cancelUnknown: { en: "We don't know when this was cancelled (cancelled before the system started recording it).", pt: "Não sabemos quando foi cancelado (cancelado antes de o sistema começar a registrar a hora).", es: "No sabemos cuándo se canceló (antes de que el sistema registrara la hora).", hi: "पता नहीं कब रद्द हुआ (समय दर्ज होने से पहले रद्द)।" },
  by_cliente: { en: "by the client (booking link)", pt: "pela cliente (link da reserva)", es: "por la clienta (enlace de la reserva)", hi: "ग्राहक ने (बुकिंग लिंक)" },
  by_balcao: { en: "by the front desk", pt: "pelo balcão", es: "por la recepción", hi: "रिसेप्शन ने" },
  by_ia: { en: "by the AI on the phone", pt: "pela IA ao telefone", es: "por la IA por teléfono", hi: "फ़ोन पर AI ने" },
  by_expirou: { en: "a temporary hold that expired", pt: "reserva provisória que venceu", es: "reserva provisional que venció", hi: "अस्थायी होल्ड जो समाप्त हुआ" },
  by_desconhecido: { en: "who cancelled wasn't recorded", pt: "quem cancelou não ficou registrado", es: "no quedó registrado quién canceló", hi: "किसने रद्द किया, दर्ज नहीं" },
  windowLate: { en: "inside the {w} h cancellation window — late cancellation.", pt: "dentro da janela de {w} h do serviço — cancelamento em cima da hora.", es: "dentro de la ventana de {w} h — cancelación tardía.", hi: "{w} घंटे की विंडो के भीतर — देर से रद्द।" },
  windowOk: { en: "outside the {w} h window — no fee.", pt: "fora da janela de {w} h do serviço — sem taxa.", es: "fuera de la ventana de {w} h — sin cargo.", hi: "{w} घंटे की विंडो के बाहर — कोई शुल्क नहीं।" },
  windowNone: { en: "this service has no cancellation window (set it under Front desk → Team → Services).", pt: "este serviço não tem janela de cancelamento (defina em Balcão → Equipe → Serviços).", es: "este servicio no tiene ventana de cancelación (Recepción → Equipo → Servicios).", hi: "इस सेवा में रद्द करने की विंडो नहीं है।" },
  chargeLate: { en: "Charge late-cancel fee", pt: "Cobrar taxa de cancelamento", es: "Cobrar cancelación tardía", hi: "देर से रद्द शुल्क लें" },
  lateFeeSame: { en: "Amount = this service's no-show fee (there's no separate late-cancel fee field).", pt: "Valor = a taxa de falta do serviço (o cadastro não tem um campo próprio para cancelamento).", es: "Monto = el cargo por inasistencia del servicio (no hay un campo propio para cancelación).", hi: "राशि = इस सेवा का नो-शो शुल्क (अलग फ़ील्ड नहीं है)।" },
  confirmLate: { en: "{c} cancelled {h} before. Charge the late-cancel fee of {v} to {k}?", pt: "{c} cancelou {h} antes. Cobrar a taxa de cancelamento de {v} no {k}?", es: "{c} canceló {h} antes. ¿Cobrar {v} a {k}?", hi: "{c} ने {h} पहले रद्द किया। {k} पर {v} लें?" },
  lateCharged: { en: "Late-cancel fee charged", pt: "Taxa de cancelamento cobrada", es: "Cargo por cancelación tardía cobrado", hi: "देर से रद्द शुल्क लिया गया" },
  lateAlready: { en: "This late-cancel fee had already been charged — nothing was charged twice.", pt: "Esta taxa de cancelamento já tinha sido cobrada — nada foi cobrado duas vezes.", es: "Este cargo ya se había cobrado — no se cobró dos veces.", hi: "यह शुल्क पहले ही लिया जा चुका था।" },
  lateFailedBefore: { en: "Last attempt failed:", pt: "Última tentativa falhou:", es: "El último intento falló:", hi: "पिछला प्रयास विफल:" },
  depositPaid: { en: "She paid a deposit for this appointment.", pt: "Ela pagou sinal neste horário.", es: "Pagó un depósito por esta cita.", hi: "इस अपॉइंटमेंट का डिपॉज़िट दिया गया था।" },
  noCardAppt: { en: "No usable saved card for this client.", pt: "Esta cliente não tem cartão salvo que sirva para cobrar.", es: "Esta clienta no tiene tarjeta guardada utilizable.", hi: "इस ग्राहक का कोई उपयोगी सेव कार्ड नहीं।" },
};
// motivos novos do v6 (o resto vem do deskApi.js)
const MOTIVO_V6 = {
  not_cancelled: { en: "The appointment isn't cancelled.", pt: "O agendamento não está cancelado.", es: "La cita no está cancelada.", hi: "अपॉइंटमेंट रद्द नहीं है।" },
  cancel_time_unknown: T.cancelUnknown,
  not_late_cancel: { en: "It wasn't a late cancellation — no fee.", pt: "Não foi cancelamento em cima da hora — sem taxa.", es: "No fue una cancelación tardía — sin cargo.", hi: "यह देर से रद्द नहीं था — कोई शुल्क नहीं।" },
  noshow_fee_charged: { en: "The no-show fee was already charged on this appointment.", pt: "A taxa de falta já foi cobrada neste agendamento.", es: "El cargo por inasistencia ya se cobró en esta cita.", hi: "इस अपॉइंटमेंट पर नो-शो शुल्क पहले ही लिया गया।" },
};
const t = (k) => tx(T[k]) || k;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const contatoValido = (c) => EMAIL.test(String(c || "").trim()) || String(c || "").replace(/\D/g, "").length >= 7;

/** POST /api/desk-pagamentos. Devolve { http, d } — nunca lança. */
async function chamar(email, key, corpo) {
  try {
    const r = await fetch("/api/desk-pagamentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, key, lang: lang(), ...corpo }) });
    return { http: r.status, d: await r.json().catch(() => null) };
  } catch { return { http: 0, d: null }; }
}
// motivo + o que o Stripe disse (frase do banco, nome da permissão)
const motivoCompleto = (d, http) => [MOTIVO_V6[d?.reason] ? tx(MOTIVO_V6[d.reason]) : motivo(d, http), d?.permissao, d?.reason === "card_declined" ? d?.detail : ""].filter(Boolean).join(" ");
// 5 → "5 h"; 0,7 → "42 min"
const horas = (h) => (Math.abs(h) < 1 ? `${Math.max(1, Math.round(Math.abs(h) * 60))} min` : `${Math.round(Math.abs(h) * 10) / 10} h`);
const nomeCartao = (c) => `${String(c?.brand || "").toUpperCase() || "CARD"} •••• ${c?.last4 || "????"}`;

export default function DeskPagamentosOnline({ email, dataKey, conectado, tz, contato = "", nome = "", appt = null, feeCents = 0 }) {
  const contact = String(contato || "").trim();
  const [stBruto, setSt] = useState({ fase: "", d: null, contact: "" });
  const [seq, setSeq] = useState(0);
  const [ocupado, setOcupado] = useState("");
  const [linkBruto, setLink] = useState(null);      // { url, kind: 'card' | 'membership', contact }
  const [taxaBruta, setTaxa] = useState(null);      // resultado da cobrança, { ok, d|msg, contact }
  const [planos, setPlanos] = useState(null);       // null | { fase, lista }
  const [plano, setPlano] = useState("");
  const [cancBruto, setCanc] = useState({ fase: "", d: null, id: "" });   // cancelamento_info deste agendamento
  const [cancSeq, setCancSeq] = useState(0);
  const [taxaCancBruta, setTaxaCanc] = useState(null);                   // { ok, d|msg, id }
  const ehCancelado = appt?.status === "cancelled" || appt?.status === "canceled";

  useEffect(() => {
    if (!conectado || !contatoValido(contact)) return undefined;
    let vivo = true;
    const id = setTimeout(async () => {
      setSt({ fase: "lendo", d: null, contact });
      const { d } = await chamar(email, dataKey, { action: "cartao_status", contact });
      if (vivo) setSt(d?.ok ? { fase: "ok", d, contact } : { fase: "falhou", d, contact });
    }, 500);
    return () => { vivo = false; clearTimeout(id); };
  }, [conectado, contact, email, dataKey, seq]);
  useEffect(() => {
    if (!conectado || !ehCancelado || !appt?.id) return undefined;
    let vivo = true;
    const id = appt.id;
    chamar(email, dataKey, { action: "cancelamento_info", id }).then(({ http, d }) => {
      if (vivo) setCanc(d?.ok ? { fase: "ok", d, id } : { fase: "falhou", d, id, msg: motivoCompleto(d, http) });
    });
    return () => { vivo = false; };
  }, [conectado, ehCancelado, appt?.id, email, dataKey, cancSeq]);
  // ainda não chegou a leitura DESTE agendamento = "conferindo…" (sem setState síncrono no efeito)
  const canc = !ehCancelado || !conectado ? { fase: "", d: null } : cancBruto.id === appt?.id ? cancBruto : { fase: "lendo", d: null };
  const taxaCanc = taxaCancBruta?.id === appt?.id ? taxaCancBruta : null;
  // tudo o que a tela mostra é DESTA cliente: trocou o contato, o cartão/link/taxa da anterior some
  const st = stBruto.contact === contact && contatoValido(contact) ? stBruto : { fase: "", d: null };
  const link = linkBruto?.contact === contact ? linkBruto : null;
  const taxa = taxaBruta?.contact === contact ? taxaBruta : null;

  const ligado = st.d?.connected === true;
  const card = st.d?.card || null;
  const ehFalta = appt?.status === "no_show";

  const copiar = useCallback(async (u) => { try { await navigator.clipboard.writeText(u); toast(t("copied")); } catch { toast(u); } }, []);

  const salvarCartao = async () => {
    if (ocupado) return;
    setOcupado("card"); setLink(null);
    const { http, d } = await chamar(email, dataKey, { action: "salvar_cartao_link", contact, name: nome });
    setOcupado("");
    if (d?.ok && d.url) setLink({ url: d.url, kind: "card", contact }); else toast(motivoCompleto(d, http));
  };

  const cobrarFalta = async () => {
    if (ocupado || !appt?.id) return;
    const msg = tx(T.confirmFee).replace("{v}", dinheiro(feeCents, tz)).replace("{c}", nomeCartao(card));
    if (!window.confirm(msg)) return;
    setOcupado("fee"); setTaxa(null);
    const { http, d } = await chamar(email, dataKey, { action: "cobrar_falta", id: appt.id });
    setOcupado("");
    setTaxa(d?.ok === true ? { ok: true, d, contact } : { ok: false, msg: motivoCompleto(d, http), contact });
  };

  const cobrarCancelamento = async () => {
    const c = canc.d;
    if (ocupado || !appt?.id || !c) return;
    const msg = tx(T.confirmLate).replace("{c}", appt.customer_name || "—").replace("{h}", horas(c.horas_antes || 0))
      .replace("{v}", dinheiro(c.fee_cents, tz)).replace("{k}", nomeCartao(c.card));
    if (!window.confirm(msg)) return;
    setOcupado("late"); setTaxaCanc(null);
    const { http, d } = await chamar(email, dataKey, { action: "cobrar_cancelamento", id: appt.id });
    setOcupado("");
    setTaxaCanc(d?.ok === true ? { ok: true, d, id: appt.id } : { ok: false, msg: motivoCompleto(d, http), id: appt.id });
    setCancSeq((n) => n + 1);
  };

  const abrirAssinaturas = async () => {
    if (planos?.fase === "lendo") return;
    setPlanos({ fase: "lendo", lista: [] });
    const { http, d } = await chamar(email, dataKey, { action: "assinaturas" });
    setPlanos(d?.ok ? { fase: "ok", lista: d.memberships || [] } : { fase: "falhou", lista: [], msg: motivoCompleto(d, http) });
  };
  const linkAssinatura = async () => {
    if (ocupado || !plano) return;
    setOcupado("member"); setLink(null);
    const { http, d } = await chamar(email, dataKey, { action: "assinatura_link", membership_id: plano, contact, name: nome });
    setOcupado("");
    if (d?.ok && d.url) setLink({ url: d.url, kind: "membership", contact }); else toast(motivoCompleto(d, http));
  };

  const botao = "rounded-full border px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold disabled:opacity-40";
  const secao = "rounded-xl2 border border-white/10 bg-white/[0.03] p-3 space-y-2.5";

  if (!conectado) {
    return (
      <section className={secao}>
        <div className="text-xs font-extrabold text-g-word">{t("title")}</div>
        <div className="text-[11px] text-g-muted">{t("sample")}</div>
      </section>
    );
  }

  const podeAgir = ligado && contatoValido(contact) && !ocupado;
  return (
    <section className={secao} aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs font-extrabold text-g-word">{t("title")}</div>
        {ligado && st.d?.mode === "test" && <span className="text-[10px] font-black uppercase text-yellow-200">{t("testMode")}</span>}
      </div>

      {!contatoValido(contact) && <div className="text-[11px] text-g-muted">{t("needContact")}</div>}
      {st.fase === "lendo" && <div className="text-[11px] text-g-muted">{t("reading")}</div>}
      {st.fase === "falhou" && <div className="text-[11px] text-red-300">{st.d?.reason ? motivoCompleto(st.d) : t("readFail")}</div>}
      {st.fase === "ok" && !ligado && <div className="rounded-xl border border-g-gold/30 bg-g-gold/[0.06] px-3 py-2 text-[11px] text-g-light">{t("notConnected")}</div>}
      {st.fase === "ok" && ligado && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
          {card ? (
            <>
              <span className="text-g-muted">{t("saved")}: </span>
              <span className="font-bold text-g-word num">{nomeCartao(card)}{card.exp_month ? ` · ${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year || "").slice(-2)}` : ""}</span>
              {!card.usable && <div className="text-[11px] text-yellow-200 mt-0.5">{t("otherMode")}</div>}
            </>
          ) : <span className="text-g-muted">{t("noCard")}</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={salvarCartao} disabled={!podeAgir} className={`${botao} border-white/15 text-g-word`}>{ocupado === "card" ? t("working") : t("saveCard")}</button>
        {ehFalta && (
          <button type="button" onClick={cobrarFalta} disabled={!podeAgir || !card?.usable || taxa?.ok} className={`${botao} border-red-300/40 text-red-200`}>
            {ocupado === "fee" ? t("working") : `${t("chargeFee")}${feeCents > 0 ? ` ${dinheiro(feeCents, tz)}` : ""}`}
          </button>
        )}
        <button type="button" onClick={abrirAssinaturas} disabled={!podeAgir} className={`${botao} border-g-gold/40 text-g-gold`}>{t("sellMembership")}</button>
      </div>
      {appt && !ehFalta && !ehCancelado && <div className="text-[11px] text-g-muted">{t("feeOnlyNoShow")}</div>}

      {/* ── cancelamento em cima da hora (v6): quando, quem, janela, e a cobrança ── */}
      {ehCancelado && canc.fase === "lendo" && <div className="text-[11px] text-g-muted">{t("cancelReading")}</div>}
      {ehCancelado && canc.fase === "falhou" && <div className="text-[11px] text-red-300">{canc.msg}</div>}
      {ehCancelado && canc.fase === "ok" && (() => {
        const c = canc.d;
        const quem = t(`by_${["cliente", "balcao", "ia", "expirou"].includes(c.cancelled_by) ? c.cancelled_by : "desconhecido"}`);
        const podeCobrar = c.connected && c.late && !c.charged && c.card?.usable && !ocupado && !taxaCanc?.ok;
        return (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs space-y-1.5">
            {c.why === "cancel_time_unknown" ? <div className="text-g-muted">{t("cancelUnknown")}</div> : (
              <div className="text-g-word">
                <span className="font-bold num">{c.horas_antes < 0 ? t("cancelledAfter") : tx(T.cancelledH).replace("{h}", horas(c.horas_antes))}</span>
                <span className="text-g-muted"> · {quem}{c.cancelled_at ? ` · ${quando(c.cancelled_at, tz)}` : ""}</span>
                {c.why !== "expired_hold" && (
                  <div className={`text-[11px] mt-0.5 ${c.late ? "text-amber-200" : "text-g-muted"}`}>
                    {c.late ? tx(T.windowLate).replace("{w}", c.janela_h) : c.why === "no_window" ? t("windowNone") : tx(T.windowOk).replace("{w}", c.janela_h)}
                  </div>
                )}
              </div>
            )}
            {c.late && c.deposit_paid && <div className="text-[11px] text-g-muted">{t("depositPaid")}</div>}
            {c.late && (
              <>
                <button type="button" onClick={cobrarCancelamento} disabled={!podeCobrar} className={`${botao} border-red-300/40 text-red-200`}>
                  {ocupado === "late" ? t("working") : `${t("chargeLate")}${c.fee_cents > 0 ? ` ${dinheiro(c.fee_cents, tz)}` : ""}`}
                </button>
                <div className="text-[11px] text-g-muted">{t("lateFeeSame")}</div>
                {c.charged && !taxaCanc && <div className="text-[11px] text-g-green">✓ {t("lateCharged")}{c.fee?.cents ? `: ${dinheiro(c.fee.cents, tz)}` : ""}{c.fee?.card ? ` · ${c.fee.card}` : ""}</div>}
                {!c.charged && c.fee?.status === "failed" && !taxaCanc && <div className="text-[11px] text-red-300">{t("lateFailedBefore")} {motivoCompleto({ reason: c.fee.reason })}</div>}
                {c.connected && !c.charged && !c.card?.usable && <div className="text-[11px] text-g-muted">{t("noCardAppt")} {motivo({ reason: "no_saved_card" })}</div>}
                {!c.connected && <div className="text-[11px] text-g-light">{t("notConnected")}</div>}
                {!c.charged && c.fee_cents < 50 && <div className="text-[11px] text-g-muted">{motivo({ reason: "no_fee_configured" })}</div>}
              </>
            )}
          </div>
        );
      })()}
      {taxaCanc && (
        <div role={taxaCanc.ok ? undefined : "alert"} className={`rounded-xl border px-3 py-2 text-xs ${taxaCanc.ok ? "border-g-green/30 bg-g-green/[0.06] text-g-word" : "border-red-400/30 bg-red-400/[0.06] text-red-300"}`}>
          {taxaCanc.ok ? (taxaCanc.d.already ? t("lateAlready") : `✓ ${t("lateCharged")}: ${dinheiro(taxaCanc.d.cents, tz)}${taxaCanc.d.card ? ` · ${taxaCanc.d.card}` : ""}`) : taxaCanc.msg}
        </div>
      )}
      {ehFalta && ligado && !card?.usable && st.fase === "ok" && <div className="text-[11px] text-g-muted">{motivo({ reason: "no_saved_card" })}</div>}

      {taxa && (
        <div role={taxa.ok ? undefined : "alert"} className={`rounded-xl border px-3 py-2 text-xs ${taxa.ok ? "border-g-green/30 bg-g-green/[0.06] text-g-word" : "border-red-400/30 bg-red-400/[0.06] text-red-300"}`}>
          {taxa.ok ? (taxa.d.already ? t("feeAlready") : `✓ ${t("feeCharged")}: ${dinheiro(taxa.d.cents, tz)}${taxa.d.card ? ` · ${taxa.d.card}` : ""}`) : taxa.msg}
        </div>
      )}

      {planos && (
        <div className="space-y-1.5">
          {planos.fase === "lendo" && <div className="text-[11px] text-g-muted">{t("working")}</div>}
          {planos.fase === "falhou" && <div className="text-[11px] text-red-300">{planos.msg}</div>}
          {planos.fase === "ok" && !planos.lista.length && <div className="text-[11px] text-g-muted">{t("noMemberships")}</div>}
          {planos.fase === "ok" && planos.lista.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <select value={plano} onChange={(e) => setPlano(e.target.value)} className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 min-h-[40px] text-sm text-g-word [color-scheme:dark]" aria-label={t("sellMembership")}>
                <option value="">{t("pickMembership")}</option>
                {planos.lista.map((m) => <option key={m.id} value={m.id}>{m.name} · {dinheiro(m.price_cents, tz)}{m.interval === "year" ? t("year") : t("month")}{m.subscribers ? ` · ${m.subscribers} ${t("members")}` : ""}</option>)}
              </select>
              <button type="button" onClick={linkAssinatura} disabled={!plano || !podeAgir} className={`${botao} border-g-gold/40 text-g-gold`}>{ocupado === "member" ? t("working") : t("makeLink")}</button>
            </div>
          )}
        </div>
      )}

      {link && (
        <div className="rounded-xl border border-g-green/30 bg-g-green/[0.06] p-3 space-y-1.5">
          <div className="text-[11px] text-g-word">{t("linkReady")} {link.kind === "card" ? t("linkCard") : t("linkMember")}</div>
          <div className="flex items-center gap-2">
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-g-word" aria-label="link" />
            <button type="button" onClick={() => copiar(link.url)} className={`${botao} border-white/15 text-g-word shrink-0`}>{t("copy")}</button>
          </div>
          {link.kind === "card" && <button type="button" onClick={() => setSeq((n) => n + 1)} className="text-[11px] font-bold text-g-green underline py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px]">{t("check")}</button>}
        </div>
      )}
    </section>
  );
}
