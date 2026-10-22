/* GUILEO DESK — Relatórios (2026-10-05). O que o MindBody mostra e a Central não mostrava, e o que a
   apresentação do Natura prometeu (slide "Produtividade e qualidade"): quem está mais ocupada, quem
   remarca, faltas por profissional, clientes novas × recorrentes, retenção e serviços que mais faturam.
   Fonte: action "reports" de /api/desk (db/desk_v3.sql desk_reports). Conta conectada nunca mostra amostra. */
import { useEffect, useMemo, useState } from "react";
import { Card, SectionSkeleton } from "../pages/Portal.jsx";
import { toast } from "../lib/portalApi.js";
import { chamarDesk, dinheiro, tx, paraUtc, diaDe, somaDias, hhmm } from "./deskApi.js";

const T = {
  title: { en: "Reports", pt: "Relatórios", es: "Informes", hi: "रिपोर्ट" },
  p7: { en: "Last 7 days", pt: "Últimos 7 dias", es: "Últimos 7 días", hi: "पिछले 7 दिन" },
  p30: { en: "Last 30 days", pt: "Últimos 30 dias", es: "Últimos 30 días", hi: "पिछले 30 दिन" },
  p90: { en: "Last 90 days", pt: "Últimos 90 dias", es: "Últimos 90 días", hi: "पिछले 90 दिन" },
  allLoc: { en: "All locations", pt: "Todas as unidades", es: "Todas las sedes", hi: "सभी लोकेशन" },
  visits: { en: "Visits", pt: "Visitas", es: "Visitas", hi: "विज़िट" },
  clients: { en: "Clients", pt: "Clientes", es: "Clientas", hi: "ग्राहक" },
  newc: { en: "New clients", pt: "Clientes novas", es: "Clientas nuevas", hi: "नए ग्राहक" },
  ret: { en: "Returning", pt: "Recorrentes", es: "Recurrentes", hi: "लौटने वाले" },
  rebook: { en: "Left with the next visit booked", pt: "Saíram com o próximo horário marcado", es: "Salieron con la próxima cita", hi: "अगली बुकिंग के साथ गए" },
  retention: { en: "Came back (vs. previous period)", pt: "Voltaram (vs. período anterior)", es: "Volvieron (vs. período anterior)", hi: "वापस आए" },
  noshow: { en: "No-shows", pt: "Faltas", es: "Ausencias", hi: "नहीं आए" },
  cancel: { en: "Cancellations", pt: "Cancelamentos", es: "Cancelaciones", hi: "रद्द" },
  byPro: { en: "By professional", pt: "Por profissional", es: "Por profesional", hi: "प्रोफ़ेशनल के हिसाब से" },
  util: { en: "Busy", pt: "Ocupação", es: "Ocupación", hi: "व्यस्तता" },
  utilHelp: { en: "Booked hours ÷ open hours (weekly schedule minus blocks).", pt: "Horas marcadas ÷ horas abertas (expediente semanal menos bloqueios).", es: "Horas reservadas ÷ horas abiertas (horario semanal menos bloqueos).", hi: "बुक घंटे ÷ खुले घंटे।" },
  appts: { en: "Bookings", pt: "Agendamentos", es: "Reservas", hi: "बुकिंग" },
  hours: { en: "Booked hours", pt: "Horas marcadas", es: "Horas reservadas", hi: "बुक घंटे" },
  noSched: { en: "no schedule", pt: "sem expediente", es: "sin horario", hi: "कोई शेड्यूल नहीं" },
  top: { en: "Services that bring the most", pt: "Serviços que mais trazem", es: "Servicios que más aportan", hi: "सबसे ज़्यादा कमाने वाली सेवाएँ" },
  revenue: { en: "Charged at the desk", pt: "Cobrado no caixa", es: "Cobrado en caja", hi: "डेस्क पर चार्ज" },
  source: { en: "Where bookings came from", pt: "De onde vieram os agendamentos", es: "De dónde vinieron las reservas", hi: "बुकिंग कहाँ से आईं" },
  src_desk: { en: "Front desk", pt: "Balcão", es: "Recepción", hi: "फ्रंट डेस्क" },
  src_gui: { en: "AI (phone/chat)", pt: "IA (telefone/chat)", es: "IA (teléfono/chat)", hi: "AI" },
  src_web: { en: "Online booking", pt: "Agendamento online", es: "Reserva en línea", hi: "ऑनलाइन" },
  src_mindbody: { en: "Imported from MindBody", pt: "Importado do MindBody", es: "Importado de MindBody", hi: "MindBody" },
  empty: { en: "No visits in this period yet.", pt: "Ainda não há visitas neste período.", es: "Aún no hay visitas en este período.", hi: "इस अवधि में अभी कोई विज़िट नहीं।" },
  fail: { en: "I couldn't read the reports.", pt: "Não consegui ler os relatórios.", es: "No pude leer los informes.", hi: "रिपोर्ट नहीं पढ़ पाया।" },
  retry: { en: "Try again", pt: "Tentar de novo", es: "Intentar de nuevo", hi: "फिर कोशिश करें" },
  heat: { en: "Busiest days and hours", pt: "Dias e horários mais cheios", es: "Días y horas más llenos", hi: "सबसे व्यस्त दिन और घंटे" },
  heatHelp: { en: "Bookings by start time, in the location's time zone.", pt: "Agendamentos pela hora de início, no fuso da unidade.", es: "Reservas por hora de inicio, en la zona horaria de la sede.", hi: "शुरू होने के समय के हिसाब से।" },
  trend: { en: "Up and down vs. the previous period", pt: "Subiu e caiu vs. o período anterior", es: "Subió y bajó vs. el período anterior", hi: "पिछली अवधि की तुलना में" },
  sells: { en: "Who sells the most (at the desk)", pt: "Quem vende mais (no caixa)", es: "Quién vende más (en caja)", hi: "सबसे ज़्यादा कौन बेचता है" },
  svc: { en: "Services", pt: "Serviços", es: "Servicios", hi: "सेवाएँ" },
  prod: { en: "Products", pt: "Produtos", es: "Productos", hi: "उत्पाद" },
  tips: { en: "Tips", pt: "Gorjetas", es: "Propinas", hi: "टिप" },
  ticket: { en: "Avg. ticket", pt: "Ticket médio", es: "Ticket medio", hi: "औसत बिल" },
  noSales: { en: "Nothing charged at the desk in this period yet.", pt: "Nada cobrado no caixa neste período ainda.", es: "Nada cobrado en caja en este período aún.", hi: "अभी तक कुछ चार्ज नहीं हुआ।" },
  extraFail: { en: "Part of the report (busiest hours, trends, sales) didn't load.", pt: "Uma parte do relatório (horários, tendência, vendas) não carregou.", es: "Una parte del informe no cargó.", hi: "रिपोर्ट का एक हिस्सा लोड नहीं हुआ।" },
  said: { en: "What clients said, by provider", pt: "O que as clientes disseram, por profissional", es: "Lo que dijeron las clientas, por profesional", hi: "ग्राहकों ने क्या कहा" },
  saidHelp: { en: "Private comments clients write after the visit. There's no star score — just their words.", pt: "Comentários privados que a cliente escreve depois da visita. Não há nota — são as palavras dela.", es: "Comentarios privados después de la visita. No hay nota — son sus palabras.", hi: "विज़िट के बाद की निजी टिप्पणियाँ।" },
  comments: { en: "comments", pt: "comentários", es: "comentarios", hi: "टिप्पणियाँ" },
  noComments: { en: "No comments in this period.", pt: "Nenhum comentário neste período.", es: "Sin comentarios en este período.", hi: "कोई टिप्पणी नहीं।" },
  commission: { en: "Commission", pt: "Comissão", es: "Comisión", hi: "कमीशन" },
  payroll: { en: "Export payroll (CSV)", pt: "Exportar folha (CSV)", es: "Exportar nómina (CSV)", hi: "पेरोल CSV" },
  toPay: { en: "To pay", pt: "A pagar", es: "A pagar", hi: "भुगतान" },
  cross: { en: "✨ Introduce one location to another's clients", pt: "✨ Apresentar uma unidade às clientes de outra", es: "✨ Presentar una sede a las clientas de otra", hi: "✨ एक लोकेशन दूसरी के ग्राहकों को दिखाएँ" },
  crossHelp: { en: "Clients (with email) who came to the first location and never booked at the second. Unsubscribed people are left out. This only creates a DRAFT campaign — you review the offer and send it.", pt: "Clientes (com e-mail) que vieram à primeira unidade e nunca marcaram na segunda. Quem se descadastrou fica de fora. Isto só cria um RASCUNHO de campanha — você revisa a oferta e envia.", es: "Clientas (con correo) que vinieron a la primera sede y nunca reservaron en la segunda. Quien se dio de baja queda fuera. Solo crea un BORRADOR — tú revisas y envías.", hi: "केवल ड्राफ़्ट बनता है — आप समीक्षा करके भेजें।" },
  crossFrom: { en: "Clients of", pt: "Clientes de", es: "Clientas de", hi: "के ग्राहक" },
  crossTo: { en: "who never went to", pt: "que nunca foram a", es: "que nunca fueron a", hi: "जो कभी नहीं गए" },
  crossCount: { en: "{n} clients", pt: "{n} clientes", es: "{n} clientas", hi: "{n} ग्राहक" },
  crossDraft: { en: "Create draft campaign", pt: "Criar rascunho da campanha", es: "Crear borrador", hi: "ड्राफ़्ट बनाएँ" },
  crossDone: { en: "Draft created in Coupons & Campaigns — review the offer and send.", pt: "Rascunho criado em Cupons & Campanhas — revise a oferta e envie.", es: "Borrador creado en Cupones y Campañas — revisa y envía.", hi: "ड्राफ़्ट बना — समीक्षा करें।" },
  crossOpen: { en: "Open Campaigns →", pt: "Abrir Campanhas →", es: "Abrir Campañas →", hi: "कैंपेन खोलें →" },
  units: { en: "Locations side by side", pt: "Unidades lado a lado", es: "Sedes lado a lado", hi: "लोकेशन साथ-साथ" },
  unitsHelp: { en: "Charged at the desk, by location.", pt: "Cobrado no caixa, por unidade.", es: "Cobrado en caja, por sede.", hi: "लोकेशन के हिसाब से।" },
  ticket2: { en: "Avg. ticket", pt: "Ticket médio", es: "Ticket medio", hi: "औसत बिल" },
  sample: { en: "Sample numbers — connect your account to see yours.", pt: "Números de exemplo — conecte a sua conta para ver os seus.", es: "Números de ejemplo — conecta tu cuenta para ver los tuyos.", hi: "नमूना आँकड़े।" },
};
const t = (k) => tx(T[k]) || k;
const pct = (a, b) => (b > 0 ? `${Math.round((100 * a) / b)}%` : "—");

const AMOSTRA = { ok: true, visits: 142, clients: 118, new_clients: 31, returning_clients: 87, rebook: { visits: 142, rebooked: 61 }, retention: { base: 120, returned: 74 }, no_show: 6, cancelled: 11, booked: 159,
  by_source: { desk: 71, gui: 52, web: 24, mindbody: 12 },
  by_pro: [{ pro_id: "1", name: "Ana", booked_min: 5400, scheduled_min: 6600, blocked_min: 300, utilization_pct: 85.7, appointments: 58, no_shows: 2, cancelled: 4 },
    { pro_id: "2", name: "Bianca", booked_min: 4200, scheduled_min: 6000, blocked_min: 0, utilization_pct: 70, appointments: 49, no_shows: 3, cancelled: 5 },
    { pro_id: "3", name: "Carla", booked_min: 2700, scheduled_min: 6000, blocked_min: 600, utilization_pct: 50, appointments: 52, no_shows: 1, cancelled: 2 }],
  top_services: [{ name: "Deep Tissue 60min", visits: 41, revenue_cents: 512500 }, { name: "Signature Facial", visits: 33, revenue_cents: 445500 }, { name: "Gel Manicure", visits: 38, revenue_cents: 209000 }],
  extra_ok: true,
  unidades: [
    { location_id: "L1", location: "Astoria", visits: 88, booked: 97, no_show: 3, cancelled: 6, clients: 71, revenue_cents: 1184000, sales: 84, avg_ticket_cents: 14095, utilization_pct: 78.2 },
    { location_id: "L2", location: "Upper East Side", visits: 41, booked: 47, no_show: 2, cancelled: 4, clients: 36, revenue_cents: 642000, sales: 39, avg_ticket_cents: 16462, utilization_pct: 61.5 },
    { location_id: "L3", location: "Med Spa UES", visits: 13, booked: 15, no_show: 1, cancelled: 1, clients: 12, revenue_cents: 395000, sales: 12, avg_ticket_cents: 32917, utilization_pct: 34.0 },
  ],
  heatmap: [2, 3, 4, 5, 6].flatMap((dow) => [10, 11, 12, 13, 14, 15, 16, 17, 18].map((hour) => ({ dow, hour, n: Math.max(0, Math.round((dow === 6 ? 6 : dow === 5 ? 5 : 3) - Math.abs(hour - 14) * 0.6)) }))),
  service_trend: [{ service_id: "a", name: "Deep Tissue 60min", now: 41, before: 34 }, { service_id: "b", name: "Signature Facial", now: 33, before: 35 }, { service_id: "c", name: "Gel Manicure", now: 38, before: 29 }, { service_id: "d", name: "Hot Stone 90min", now: 6, before: 14 }],
  pro_sales: [{ pro_id: "1", name: "Ana", service_cents: 612000, product_cents: 84000, tip_cents: 91000, sales: 54, avg_ticket_cents: 12889, commission_cents: 247800 }, { pro_id: "2", name: "Bianca", service_cents: 455000, product_cents: 21000, tip_cents: 60000, sales: 44, avg_ticket_cents: 10818, commission_cents: 182000 }],
  opinioes: [{ pro_id: "1", name: "Ana", total: 3, visitas: 58, ultimos: [{ texto: "Best deep tissue I've had in NYC.", cliente: "Maria", servico: "Deep Tissue 60min" }, { texto: "Ana remembered my shoulder issue from last time.", cliente: "Jenny", servico: "Deep Tissue 60min" }] }, { pro_id: "2", name: "Bianca", total: 1, visitas: 49, ultimos: [{ texto: "Waited 15 minutes past my time.", cliente: "Olivia", servico: "Signature Facial" }] }] };
const DIAS = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"], hi: ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"] };

function MapaDeCalor({ pontos }) {
  const horas = [...new Set(pontos.map((p) => p.hour))].sort((a, b) => a - b);
  if (!horas.length) return <p className="text-sm text-g-muted">{t("empty")}</p>;
  const de = horas[0], ate = horas[horas.length - 1];
  const faixa = Array.from({ length: ate - de + 1 }, (_, i) => de + i);
  const max = Math.max(1, ...pontos.map((p) => p.n));
  const n = (d, h) => pontos.find((p) => p.dow === d && p.hour === h)?.n || 0;
  const dias = [1, 2, 3, 4, 5, 6, 0].filter((d) => pontos.some((p) => p.dow === d));
  const nomes = tx(DIAS);
  return (
    <div className="overflow-x-auto">
      <table className="text-[11px] border-separate" style={{ borderSpacing: 3 }}>
        <thead><tr><th></th>{faixa.map((h) => <th key={h} className="font-normal text-g-muted px-0.5 whitespace-nowrap">{hhmm(h * 60).replace(/:00/, "")}</th>)}</tr></thead>
        <tbody>
          {dias.map((d) => (
            <tr key={d}>
              <td className="pr-2 text-g-muted whitespace-nowrap">{nomes[d]}</td>
              {faixa.map((h) => { const v = n(d, h); return (
                <td key={h} title={`${nomes[d]} ${hhmm(h * 60)} · ${v}`} className="w-8 h-7 rounded text-center num" style={{ background: v ? `rgba(47,227,154,${0.12 + 0.75 * (v / max)})` : "rgba(255,255,255,0.03)", color: v / max > 0.55 ? "#0d1a14" : "var(--g-muted, #9a958c)" }}>{v || ""}</td>
              ); })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// SLIDE 19 — "Apresentar o Med Spa às clientes de Astoria: sua lista, a mensagem aprovada por você".
// Conta o público (desk_publico_cruzado_conta) e cria SÓ um rascunho em /api/coupons (campaign_upsert). Quem envia é
// a dona, pelo campaign_send de sempre (descadastro e endereço postal incluídos). Nada sai daqui.
function ApresentarUnidade({ email, dataKey, conectado, unidades, negocio }) {
  const ids = unidades.map((u) => u.location_id);
  const [de, setDe] = useState(ids[0] || "");
  const [para, setPara] = useState(ids[ids.length - 1] || "");
  const [conta, setConta] = useState(null);
  const [feito, setFeito] = useState(false);
  const nome = (id) => unidades.find((u) => u.location_id === id)?.location || "";
  useEffect(() => {
    let vivo = true; setConta(null); setFeito(false);
    if (!de || !para || de === para) return () => { vivo = false; };
    if (!conectado) { setConta(37); return () => { vivo = false; }; }
    chamarDesk(email, dataKey, { action: "publico_cruzado", de, para }).then(({ d }) => { if (vivo) setConta(d?.ok ? d.total : -1); });
    return () => { vivo = false; };
  }, [de, para, conectado, email, dataKey]);
  const criar = async () => {
    if (!conectado) { setFeito(true); return; }
    const pt = tx({ en: "en", pt: "pt", es: "es", hi: "en" });
    const assunto = pt === "pt" ? `Conheça ${nome(para)}${negocio ? ` da ${negocio}` : ""}` : pt === "es" ? `Conoce ${nome(para)}${negocio ? ` de ${negocio}` : ""}` : `Meet ${nome(para)}${negocio ? ` at ${negocio}` : ""}`;
    const corpo = pt === "pt" ? `Você já é cliente da nossa unidade ${nome(de)} — obrigada por isso! Queremos te apresentar ${nome(para)}. [Escreva aqui a oferta de boas-vindas antes de enviar.]`
      : pt === "es" ? `Ya eres clienta de nuestra sede ${nome(de)} — ¡gracias! Queremos presentarte ${nome(para)}. [Escribe aquí la oferta de bienvenida antes de enviar.]`
        : `You're already a client at our ${nome(de)} location — thank you! We'd love to introduce you to ${nome(para)}. [Write your welcome offer here before sending.]`;
    try {
      const r = await fetch("/api/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, key: dataKey, action: "campaign_upsert",
        campaign: { name: `${nome(de)} → ${nome(para)}`, kind: "promo", template: "promo", audience: `cruzada:${de}:${para}`, subject: assunto, body: corpo } }) });
      const d = await r.json().catch(() => null);
      if (r.ok && d && d.ok !== false && !d.error) setFeito(true); else toast(d?.error || d?.note || "—");
    } catch { toast("—"); }
  };
  const sel = "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-g-word [color-scheme:dark]";
  return (
    <Card>
      <div className="text-sm font-bold text-g-word">{t("cross")}</div>
      <p className="mt-1 text-[11px] text-g-muted max-w-2xl">{t("crossHelp")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-g-muted">
        <span>{t("crossFrom")}</span>
        <select value={de} onChange={(e) => setDe(e.target.value)} className={sel}>{unidades.map((u) => <option key={u.location_id} value={u.location_id}>{u.location}</option>)}</select>
        <span>{t("crossTo")}</span>
        <select value={para} onChange={(e) => setPara(e.target.value)} className={sel}>{unidades.map((u) => <option key={u.location_id} value={u.location_id}>{u.location}</option>)}</select>
        {conta != null && conta >= 0 && <span className="rounded-full bg-g-gold/15 px-3 py-1 font-bold text-g-gold num">{t("crossCount").replace("{n}", conta)}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!feito ? <button disabled={!conta || de === para} onClick={criar} className="rounded-full bg-g-green px-4 py-2 text-xs font-extrabold text-[#161512] disabled:opacity-40">{t("crossDraft")}</button>
          : <><span className="text-xs font-bold text-g-green">{t("crossDone")}</span><a href="/portal?tab=coupons" className="text-xs font-bold text-g-word underline">{t("crossOpen")}</a></>}
      </div>
    </Card>
  );
}

export default function DeskRelatorios({ email = "", dataKey = "", conectado = false, agenda = null, loc = null }) {
  const tz = loc?.tz || "America/New_York";
  const [dias, setDias] = useState(30);
  const [unidade, setUnidade] = useState(loc?.id || "");
  const [estado, setEstado] = useState({ fase: conectado ? "lendo" : "ok", d: conectado ? null : AMOSTRA });
  const [seq, setSeq] = useState(0);
  const hoje = diaDe(new Date(), tz);
  const de = paraUtc(somaDias(hoje, -dias + 1), 0, tz).toISOString();
  const ate = paraUtc(somaDias(hoje, 1), 0, tz).toISOString();

  useEffect(() => {
    let vivo = true;
    if (!conectado) return () => { vivo = false; };
    setEstado((e) => ({ fase: e.d ? "relendo" : "lendo", d: e.d }));
    chamarDesk(email, dataKey, { action: "reports", from: de, to: ate, location_id: unidade || null }).then(({ d }) => {
      if (vivo) setEstado(d?.ok ? { fase: "ok", d } : { fase: "falhou", d: null });
    });
    return () => { vivo = false; };
  }, [conectado, email, dataKey, de, ate, unidade, seq]);

  const d = estado.d;
  const fontes = useMemo(() => Object.entries(d?.by_source || {}).sort((a, b) => b[1] - a[1]), [d]);
  const totalFonte = fontes.reduce((s, [, n]) => s + n, 0);
  // FOLHA (comissão do período): por profissional — serviço, produto, gorjeta, comissão e o total a pagar
  // (comissão + gorjeta). Sai do que passou no caixa (desk_reports_extra.pro_sales), no período escolhido.
  const exportarFolha = () => {
    const linhas = [["profissional", "servicos", "produtos", "gorjetas", "comissao", "a_pagar"]];
    (d?.pro_sales || []).forEach((p) => {
      const c = (n) => ((Number(n) || 0) / 100).toFixed(2);
      linhas.push([p.name, c(p.service_cents), c(p.product_cents), c(p.tip_cents), c(p.commission_cents), c((p.commission_cents || 0) + (p.tip_cents || 0))]);
    });
    const csv = linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `folha-${somaDias(hoje, -dias + 1)}_${hoje}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { /* navegador sem download */ }
  };
  if (estado.fase === "lendo") return <SectionSkeleton rows={5} />;

  const Num = ({ k, v, sub, cor }) => (
    <Card className="!p-3">
      <div className="text-[10px] uppercase tracking-wide text-g-muted">{t(k)}</div>
      <div className="text-lg font-extrabold num mt-0.5" style={cor ? { color: cor } : undefined}>{v}</div>
      {sub && <div className="text-[11px] text-g-muted">{sub}</div>}
    </Card>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5">
          {[[7, "p7"], [30, "p30"], [90, "p90"]].map(([n, k]) => (
            <button key={n} onClick={() => setDias(n)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${dias === n ? "bg-g-green/20 text-g-word" : "text-g-muted hover:text-g-word"}`}>{t(k)}</button>
          ))}
        </div>
        {(agenda?.locations || []).length > 1 && (
          <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-g-word [color-scheme:dark]">
            <option value="">{t("allLoc")}</option>
            {agenda.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
      </div>
      {!conectado && <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] px-4 py-2.5 text-xs text-g-light">{t("sample")}</div>}
      {estado.fase === "falhou" && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl2 border border-red-400/30 bg-red-400/[0.06] px-4 py-2.5 text-xs text-red-300">
          <span>{t("fail")}</span><button onClick={() => setSeq((n) => n + 1)} className="font-bold text-g-word underline">{t("retry")}</button>
        </div>
      )}
      {d && (
        <>
          {d.visits === 0 && <Card><p className="text-sm text-g-muted">{t("empty")}</p></Card>}
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2 ${estado.fase === "relendo" ? "opacity-60" : ""}`}>
            <Num k="visits" v={d.visits} />
            <Num k="clients" v={d.clients} sub={`${d.new_clients} ${t("newc").toLowerCase()} · ${d.returning_clients} ${t("ret").toLowerCase()}`} />
            <Num k="rebook" v={pct(d.rebook?.rebooked || 0, d.rebook?.visits || 0)} sub={`${d.rebook?.rebooked || 0} / ${d.rebook?.visits || 0}`} cor="#2FE39A" />
            <Num k="retention" v={pct(d.retention?.returned || 0, d.retention?.base || 0)} sub={`${d.retention?.returned || 0} / ${d.retention?.base || 0}`} cor="#D6C29A" />
            <Num k="noshow" v={d.no_show} sub={pct(d.no_show, d.booked)} cor="#FF5A5A" />
            <Num k="cancel" v={d.cancelled} sub={pct(d.cancelled, d.booked + d.cancelled)} />
          </div>

          <Card>
            <div className="flex items-baseline justify-between gap-2 mb-2"><div className="text-sm font-bold text-g-word">{t("byPro")}</div><div className="text-[11px] text-g-muted">{t("utilHelp")}</div></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-[10px] uppercase tracking-wide text-g-muted text-left"><th className="py-1.5 pr-3"></th><th className="py-1.5 pr-3">{t("util")}</th><th className="py-1.5 pr-3 text-right">{t("hours")}</th><th className="py-1.5 pr-3 text-right">{t("appts")}</th><th className="py-1.5 pr-3 text-right">{t("noshow")}</th><th className="py-1.5 text-right">{t("cancel")}</th></tr></thead>
                <tbody>
                  {(d.by_pro || []).map((p) => (
                    <tr key={p.pro_id} className="border-t border-white/[0.06]">
                      <td className="py-2 pr-3 font-bold text-g-word whitespace-nowrap">{p.name}</td>
                      <td className="py-2 pr-3 min-w-[9rem]">
                        {p.utilization_pct == null ? <span className="text-xs text-g-muted">{t("noSched")}</span> : (
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, p.utilization_pct)}%`, background: p.utilization_pct >= 80 ? "#2FE39A" : p.utilization_pct >= 50 ? "#D6C29A" : "#FF9A5A" }} /></div>
                            <span className="num text-xs text-g-word w-12 text-right">{p.utilization_pct}%</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right num text-g-muted">{Math.round((p.booked_min || 0) / 6) / 10}</td>
                      <td className="py-2 pr-3 text-right num text-g-muted">{p.appointments}</td>
                      <td className="py-2 pr-3 text-right num" style={{ color: p.no_shows ? "#FF5A5A" : undefined }}>{p.no_shows}</td>
                      <td className="py-2 text-right num text-g-muted">{p.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <div className="text-sm font-bold text-g-word mb-2">{t("top")}</div>
              <div className="space-y-1.5">
                {(d.top_services || []).slice(0, 8).map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-g-word">{s.name}</span>
                    <span className="shrink-0 text-xs text-g-muted num">{s.visits} {t("visits").toLowerCase()} · {s.revenue_cents ? dinheiro(s.revenue_cents, tz, { casas: 0 }) : "—"}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-g-muted">{t("revenue")}</div>
            </Card>
            <Card>
              <div className="text-sm font-bold text-g-word mb-2">{t("source")}</div>
              <div className="space-y-2">
                {fontes.map(([k, n]) => (
                  <div key={k}>
                    <div className="flex justify-between text-xs"><span className="text-g-word">{T[`src_${k}`] ? t(`src_${k}`) : k}</span><span className="num text-g-muted">{n} · {pct(n, totalFonte)}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-g-green" style={{ width: `${totalFonte ? (100 * n) / totalFonte : 0}%` }} /></div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {Array.isArray(d.opinioes) && d.opinioes.length > 0 && (
            <Card>
              <div className="flex items-baseline justify-between gap-2 mb-2"><div className="text-sm font-bold text-g-word">{t("said")}</div><div className="text-[11px] text-g-muted max-w-sm text-right">{t("saidHelp")}</div></div>
              <div className="grid gap-3 md:grid-cols-2">
                {d.opinioes.map((p) => (
                  <div key={p.pro_id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-baseline justify-between gap-2"><span className="text-sm font-extrabold text-g-word">{p.name}</span><span className="text-[11px] text-g-muted num">{p.total} {t("comments")} · {p.visitas} {t("visits").toLowerCase()}</span></div>
                    {(p.ultimos || []).length === 0 ? <div className="mt-1.5 text-[12px] text-g-muted">{t("noComments")}</div> : (
                      <div className="mt-2 space-y-1.5">
                        {p.ultimos.map((c, i) => (
                          <div key={i} className="text-[12.5px] leading-snug text-g-light">“{c.texto}”<span className="text-[10px] text-g-muted"> — {c.cliente || "—"}{c.servico ? ` · ${c.servico}` : ""}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
          {(d.unidades || []).length > 1 && !unidade && <ApresentarUnidade email={email} dataKey={dataKey} conectado={conectado} unidades={d.unidades} negocio="" />}
          {(d.unidades || []).length > 1 && !unidade && (
            <Card>
              <div className="flex items-baseline justify-between gap-2 mb-2"><div className="text-sm font-bold text-g-word">{t("units")}</div><div className="text-[11px] text-g-muted">{t("unitsHelp")}</div></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-[10px] uppercase tracking-wide text-g-muted text-left">
                    <th className="py-1.5 pr-3"></th><th className="py-1.5 pr-3 text-right">{t("visits")}</th><th className="py-1.5 pr-3 text-right">{t("clients")}</th><th className="py-1.5 pr-3 text-right">{t("revenue")}</th><th className="py-1.5 pr-3 text-right">{t("ticket2")}</th><th className="py-1.5 pr-3 text-right">{t("util")}</th><th className="py-1.5 pr-3 text-right">{t("noshow")}</th><th className="py-1.5 text-right">{t("cancel")}</th>
                  </tr></thead>
                  <tbody>
                    {d.unidades.map((u) => {
                      const max = Math.max(1, ...d.unidades.map((x) => x.revenue_cents || 0));
                      return (
                        <tr key={u.location_id} className="border-t border-white/[0.06]">
                          <td className="py-2 pr-3 font-bold text-g-word whitespace-nowrap">{u.location}</td>
                          <td className="py-2 pr-3 text-right num text-g-word">{u.visits}</td>
                          <td className="py-2 pr-3 text-right num text-g-muted">{u.clients}</td>
                          <td className="py-2 pr-3 text-right num min-w-[8rem]">
                            <div className="flex items-center justify-end gap-2"><span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-g-green" style={{ width: `${(100 * (u.revenue_cents || 0)) / max}%` }} /></span><span className="text-g-word">{dinheiro(u.revenue_cents, tz, { casas: 0, zeroTraco: true })}</span></div>
                          </td>
                          <td className="py-2 pr-3 text-right num text-g-muted">{u.avg_ticket_cents == null ? "—" : dinheiro(u.avg_ticket_cents, tz, { casas: 0 })}</td>
                          <td className="py-2 pr-3 text-right num text-g-muted">{u.utilization_pct == null ? "—" : `${u.utilization_pct}%`}</td>
                          <td className="py-2 pr-3 text-right num" style={{ color: u.no_show ? "#FF5A5A" : undefined }}>{u.no_show}</td>
                          <td className="py-2 text-right num text-g-muted">{u.cancelled}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {d.extra_ok === false && <div role="alert" className="rounded-xl2 border border-red-400/30 bg-red-400/[0.06] px-4 py-2.5 text-xs text-red-300">{t("extraFail")}</div>}
          {d.extra_ok && (
            <>
              <Card>
                <div className="flex items-baseline justify-between gap-2 mb-2"><div className="text-sm font-bold text-g-word">{t("heat")}</div><div className="text-[11px] text-g-muted">{t("heatHelp")}</div></div>
                <MapaDeCalor pontos={d.heatmap || []} />
              </Card>
              <div className="grid gap-3 lg:grid-cols-2">
                <Card>
                  <div className="text-sm font-bold text-g-word mb-2">{t("trend")}</div>
                  <div className="space-y-1.5">
                    {(d.service_trend || []).slice(0, 10).map((s) => {
                      const dif = s.now - s.before;
                      const cor = dif > 0 ? "#2FE39A" : dif < 0 ? "#FF5A5A" : undefined;
                      return (
                        <div key={s.service_id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-g-word">{s.name}</span>
                          <span className="shrink-0 text-xs num text-g-muted">{s.before} → <b className="text-g-word">{s.now}</b> <span style={{ color: cor }}>{dif > 0 ? `▲ ${dif}` : dif < 0 ? `▼ ${-dif}` : "="}</span></span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
                <Card>
                  <div className="mb-2 flex items-center justify-between gap-2"><div className="text-sm font-bold text-g-word">{t("sells")}</div>{(d.pro_sales || []).length > 0 && <button onClick={exportarFolha} className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-g-word hover:border-g-gold/40">⬇ {t("payroll")}</button>}</div>
                  {(d.pro_sales || []).length === 0 ? <p className="text-sm text-g-muted">{t("noSales")}</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-[10px] uppercase tracking-wide text-g-muted text-left"><th className="py-1.5 pr-3"></th><th className="py-1.5 pr-3 text-right">{t("svc")}</th><th className="py-1.5 pr-3 text-right">{t("prod")}</th><th className="py-1.5 pr-3 text-right">{t("tips")}</th><th className="py-1.5 pr-3 text-right">{t("commission")}</th><th className="py-1.5 pr-3 text-right">{t("toPay")}</th><th className="py-1.5 text-right">{t("ticket")}</th></tr></thead>
                        <tbody>
                          {d.pro_sales.map((p) => (
                            <tr key={p.pro_id} className="border-t border-white/[0.06]">
                              <td className="py-2 pr-3 font-bold text-g-word whitespace-nowrap">{p.name}</td>
                              <td className="py-2 pr-3 text-right num text-g-muted">{dinheiro(p.service_cents, tz, { casas: 0 })}</td>
                              <td className="py-2 pr-3 text-right num text-g-muted">{dinheiro(p.product_cents, tz, { casas: 0 })}</td>
                              <td className="py-2 pr-3 text-right num text-g-muted">{dinheiro(p.tip_cents, tz, { casas: 0 })}</td>
                              <td className="py-2 pr-3 text-right num text-g-muted">{dinheiro(p.commission_cents || 0, tz, { casas: 0 })}</td>
                              <td className="py-2 pr-3 text-right num font-bold text-g-word">{dinheiro((p.commission_cents || 0) + (p.tip_cents || 0), tz, { casas: 0 })}</td>
                              <td className="py-2 text-right num text-g-word">{p.avg_ticket_cents == null ? "—" : dinheiro(p.avg_ticket_cents, tz, { casas: 0 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
