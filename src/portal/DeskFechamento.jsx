/* GUILEO DESK — Fechamento de caixa (2026-10-05). A tela das 19h: quanto dinheiro ENTROU (o número
   grande), por forma de pagamento, quanto foi pré-pago resgatado (vale/pacote — já contado quando foi
   vendido), quanto cada profissional fez e ganha de comissão (a folha), e o que ficou pendurado
   (atendimento concluído sem checkout). Estorno com motivo, CSV e impressão.

   🚨 REGRAS DA CASA QUE ESTA TELA SEGUE
   · Conta conectada NUNCA mostra amostra: lendo = esqueleto, falhou = aviso com "tentar de novo".
   · Sem conexão (`!conectado`) = números de EXEMPLO declarados, nenhuma chamada, estorno bloqueado.
   · O período é calculado no fuso da UNIDADE com `paraUtc(dia, 0, tz)` — nunca o do navegador.
   · Estorno só diz "feito" com `d.ok === true`; senão mostra o `motivo()`. */
import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "../lib/portalApi.js";
import { Card, SectionSkeleton } from "../pages/Portal.jsx";
import { chamarDesk, motivo, dinheiro, quando, tx, paraUtc, diaDe, somaDias, diaDaSemana, loc as locale } from "./deskApi.js";

// ── textos ───────────────────────────────────────────────────────────────────────────────────
const T = {
  sub: { en: "What came in, who made it, and what's still open — for any period.", pt: "O que entrou, quem fez e o que ficou pendente — em qualquer período.", es: "Lo que entró, quién lo hizo y lo que quedó pendiente — en cualquier período.", hi: "क्या आया, किसने किया और क्या बाकी है — किसी भी अवधि के लिए।" },
  today: { en: "Today", pt: "Hoje", es: "Hoy", hi: "आज" },
  yesterday: { en: "Yesterday", pt: "Ontem", es: "Ayer", hi: "कल" },
  week: { en: "This week", pt: "Esta semana", es: "Esta semana", hi: "इस हफ़्ते" },
  month: { en: "This month", pt: "Este mês", es: "Este mes", hi: "इस महीने" },
  custom: { en: "Custom", pt: "Personalizado", es: "Personalizado", hi: "कस्टम" },
  from: { en: "From", pt: "De", es: "Desde", hi: "से" },
  to: { en: "To", pt: "Até", es: "Hasta", hi: "तक" },
  allLocations: { en: "All locations", pt: "Todas as unidades", es: "Todas las sedes", hi: "सभी लोकेशन" },
  rangeTooLong: { en: "Pick up to 92 days.", pt: "Escolha até 92 dias.", es: "Elige hasta 92 días.", hi: "अधिकतम 92 दिन चुनें।" },
  rangeBad: { en: "The end date must be on or after the start.", pt: "A data final tem que ser igual ou depois da inicial.", es: "La fecha final debe ser igual o posterior a la inicial.", hi: "अंतिम तारीख शुरू की तारीख के बाद होनी चाहिए।" },
  readFail: { en: "I couldn't read the close for this period.", pt: "Não consegui ler o fechamento deste período.", es: "No pude leer el cierre de este período.", hi: "इस अवधि का क्लोज़ नहीं पढ़ पाया।" },
  retry: { en: "Try again", pt: "Tentar de novo", es: "Intentar de nuevo", hi: "फिर कोशिश करें" },
  sample: { en: "Sample numbers — connect your account to see your real close.", pt: "Números de exemplo — conecte a sua conta para ver o seu fechamento de verdade.", es: "Números de ejemplo — conecta tu cuenta para ver tu cierre real.", hi: "नमूना आँकड़े — असली क्लोज़ देखने के लिए अपना खाता जोड़ें।" },
  sampleBlocked: { en: "This is a sample — connect your account to void sales.", pt: "Isto é um exemplo — conecte a sua conta para estornar vendas.", es: "Esto es un ejemplo — conecta tu cuenta para anular ventas.", hi: "यह नमूना है — बिक्री रद्द करने के लिए खाता जोड़ें।" },
  moneyIn: { en: "Money in", pt: "Dinheiro que entrou", es: "Dinero que entró", hi: "आया हुआ पैसा" },
  moneyInHelp: { en: "Cash + card + other. What should be in the drawer and the bank.", pt: "Dinheiro + cartão + outros. O que deve estar no caixa e no banco.", es: "Efectivo + tarjeta + otros. Lo que debe estar en la caja y el banco.", hi: "नकद + कार्ड + अन्य। जो दराज़ और बैंक में होना चाहिए।" },
  cash: { en: "Cash", pt: "Dinheiro", es: "Efectivo", hi: "नकद" },
  card: { en: "Card", pt: "Cartão", es: "Tarjeta", hi: "कार्ड" },
  other: { en: "Other", pt: "Outros", es: "Otros", hi: "अन्य" },
  gift_card: { en: "Gift card", pt: "Vale-presente", es: "Tarjeta regalo", hi: "गिफ्ट कार्ड" },
  package: { en: "Package", pt: "Pacote", es: "Paquete", hi: "पैकेज" },
  prepaid: { en: "Prepaid redeemed", pt: "Pré-pago resgatado", es: "Prepago canjeado", hi: "प्रीपेड इस्तेमाल" },
  prepaidHelp: { en: "Gift cards and package sessions used. Already counted as money in on the day they were sold.", pt: "Vales e sessões de pacote usados. Já entraram como dinheiro no dia em que foram vendidos.", es: "Tarjetas regalo y sesiones de paquete usadas. Ya contaron como dinero el día en que se vendieron.", hi: "इस्तेमाल हुए गिफ्ट कार्ड और पैकेज सत्र। बिकने के दिन ही पैसे में गिने जा चुके हैं।" },
  gross: { en: "Gross sales", pt: "Vendas brutas", es: "Ventas brutas", hi: "कुल बिक्री" },
  discounts: { en: "Discounts", pt: "Descontos", es: "Descuentos", hi: "छूट" },
  // cupom no caixa (desk_v14)
  coupons: { en: "Coupons used", pt: "Cupons usados", es: "Cupones usados", hi: "इस्तेमाल हुए कूपन" },
  couponsHelp: { en: "What each coupon took off in this period. Voided sales give the use back and don't count.", pt: "Quanto cada cupom descontou neste período. Venda estornada devolve o uso e não entra.", es: "Cuánto descontó cada cupón en este período. La venta anulada devuelve el uso y no cuenta.", hi: "इस अवधि में हर कूपन ने कितनी छूट दी। रद्द बिक्री का उपयोग वापस होता है और गिना नहीं जाता।" },
  uses: { en: "uses", pt: "usos", es: "usos", hi: "उपयोग" },
  use1: { en: "use", pt: "uso", es: "uso", hi: "उपयोग" },
  coupon: { en: "Coupon", pt: "Cupom", es: "Cupón", hi: "कूपन" },
  tax: { en: "Tax", pt: "Impostos", es: "Impuestos", hi: "टैक्स" },
  tips: { en: "Tips", pt: "Gorjetas", es: "Propinas", hi: "टिप" },
  avgTicket: { en: "Average ticket", pt: "Ticket médio", es: "Ticket promedio", hi: "औसत बिल" },
  salesCount: { en: "Sales", pt: "Vendas", es: "Ventas", hi: "बिक्री" },
  voided: { en: "Voided", pt: "Estornadas", es: "Anuladas", hi: "रद्द" },
  byPro: { en: "By professional", pt: "Por profissional", es: "Por profesional", hi: "प्रोफ़ेशनल के अनुसार" },
  byProHelp: { en: "Payroll view: what each one sold and earns in commission.", pt: "Visão da folha: o que cada uma vendeu e ganha de comissão.", es: "Vista de nómina: lo que cada una vendió y gana de comisión.", hi: "पेरोल व्यू: हर किसी की बिक्री और कमीशन।" },
  pro: { en: "Professional", pt: "Profissional", es: "Profesional", hi: "प्रोफ़ेशनल" },
  services: { en: "Services", pt: "Serviços", es: "Servicios", hi: "सेवाएँ" },
  products: { en: "Products", pt: "Produtos", es: "Productos", hi: "प्रोडक्ट" },
  commission: { en: "Commission", pt: "Comissão", es: "Comisión", hi: "कमीशन" },
  total: { en: "Total", pt: "Total", es: "Total", hi: "कुल" },
  noPros: { en: "No sales by professional in this period.", pt: "Nenhuma venda por profissional neste período.", es: "Ninguna venta por profesional en este período.", hi: "इस अवधि में प्रोफ़ेशनल के नाम कोई बिक्री नहीं।" },
  appointments: { en: "Appointments", pt: "Atendimentos", es: "Citas", hi: "अपॉइंटमेंट" },
  booked: { en: "Booked", pt: "Agendados", es: "Reservadas", hi: "बुक" },
  completed: { en: "Completed", pt: "Concluídos", es: "Terminadas", hi: "पूरे" },
  noShows: { en: "No-shows", pt: "Faltas", es: "Ausencias", hi: "नहीं आए" },
  cancelled: { en: "Cancelled", pt: "Cancelados", es: "Canceladas", hi: "रद्द" },
  unpaid: { en: "{n} completed visits without checkout", pt: "{n} atendimentos concluídos sem checkout", es: "{n} citas terminadas sin cobro", hi: "{n} पूरी विज़िट बिना चेकआउट" },
  unpaid1: { en: "1 completed visit without checkout", pt: "1 atendimento concluído sem checkout", es: "1 cita terminada sin cobro", hi: "1 पूरी विज़िट बिना चेकआउट" },
  salesList: { en: "Sales", pt: "Vendas", es: "Ventas", hi: "बिक्री" },
  number: { en: "No.", pt: "Nº", es: "Nº", hi: "नं." },
  time: { en: "Time", pt: "Hora", es: "Hora", hi: "समय" },
  client: { en: "Client", pt: "Cliente", es: "Clienta", hi: "ग्राहक" },
  methods: { en: "Paid with", pt: "Pago com", es: "Pagado con", hi: "भुगतान" },
  status: { en: "Status", pt: "Situação", es: "Estado", hi: "स्थिति" },
  noSales: { en: "No sales in this period.", pt: "Nenhuma venda neste período.", es: "Ninguna venta en este período.", hi: "इस अवधि में कोई बिक्री नहीं।" },
  void: { en: "Void", pt: "Estornar", es: "Anular", hi: "रद्द करें" },
  voidAsk: { en: "Void sale #{n} ({v})? This can't be undone.", pt: "Estornar a venda nº {n} ({v})? Não dá para desfazer.", es: "¿Anular la venta nº {n} ({v})? No se puede deshacer.", hi: "बिक्री #{n} ({v}) रद्द करें? यह वापस नहीं होगा।" },
  voidCoupon: { en: "The use of coupon {c} goes back to the coupon.", pt: "O uso do cupom {c} volta para o cupom.", es: "El uso del cupón {c} vuelve al cupón.", hi: "कूपन {c} का उपयोग वापस हो जाएगा।" },
  voidReason: { en: "Why are you voiding it? (required)", pt: "Por que está estornando? (obrigatório)", es: "¿Por qué la anulas? (obligatorio)", hi: "क्यों रद्द कर रहे हैं? (ज़रूरी)" },
  voidNeedReason: { en: "Write a reason to void.", pt: "Escreva o motivo do estorno.", es: "Escribe el motivo de la anulación.", hi: "रद्द करने का कारण लिखें।" },
  voidedOk: { en: "Sale voided", pt: "Venda estornada", es: "Venta anulada", hi: "बिक्री रद्द हुई" },
  already_void: { en: "This sale was already voided.", pt: "Esta venda já foi estornada.", es: "Esta venta ya fue anulada.", hi: "यह बिक्री पहले ही रद्द है।" },
  st_paid: { en: "Paid", pt: "Paga", es: "Pagada", hi: "भुगतान" },
  st_completed: { en: "Paid", pt: "Paga", es: "Pagada", hi: "भुगतान" },
  st_void: { en: "Voided", pt: "Estornada", es: "Anulada", hi: "रद्द" },
  st_voided: { en: "Voided", pt: "Estornada", es: "Anulada", hi: "रद्द" },
  st_refunded: { en: "Refunded", pt: "Reembolsada", es: "Reembolsada", hi: "रिफंड" },
  st_open: { en: "Open", pt: "Em aberto", es: "Abierta", hi: "खुली" },
  exportSales: { en: "Export sales CSV", pt: "Exportar vendas (CSV)", es: "Exportar ventas (CSV)", hi: "बिक्री CSV" },
  exportPros: { en: "Export payroll CSV", pt: "Exportar folha (CSV)", es: "Exportar nómina (CSV)", hi: "पेरोल CSV" },
  print: { en: "Print", pt: "Imprimir", es: "Imprimir", hi: "प्रिंट" },
  closeTitle: { en: "Daily close", pt: "Fechamento de caixa", es: "Cierre de caja", hi: "दैनिक क्लोज़" },
  printedAt: { en: "Printed", pt: "Impresso em", es: "Impreso el", hi: "प्रिंट किया" },
  nothingExport: { en: "Nothing to export.", pt: "Nada para exportar.", es: "Nada para exportar.", hi: "एक्सपोर्ट के लिए कुछ नहीं।" },
};
const t = (k) => tx(T[k]) || k;
const TZ_PADRAO = "America/New_York";
const anulada = (st) => /void|refund/.test(String(st || ""));
const rotuloStatus = (st) => (T[`st_${st}`] ? t(`st_${st}`) : String(st || "—"));
const rotuloMetodo = (m) => (T[m] ? t(m) : String(m || ""));
/** `methods` pode vir como lista de textos, lista de objetos ou texto separado por vírgula. */
const metodosDe = (m) => {
  const arr = Array.isArray(m) ? m : String(m || "").split(/[,+/]/);
  return arr.map((x) => (typeof x === "string" ? x.trim() : x?.method || "")).filter(Boolean);
};

// ── período no fuso da unidade ───────────────────────────────────────────────────────────────
function periodo(tipo, tz, deCustom, ateCustom) {
  const hoje = diaDe(new Date(), tz);
  let a = hoje, b = hoje; // dias inclusivos
  if (tipo === "yesterday") { a = somaDias(hoje, -1); b = a; }
  else if (tipo === "week") { const wd = diaDaSemana(hoje); a = somaDias(hoje, -((wd + 6) % 7)); b = hoje; } // semana começa na segunda
  else if (tipo === "month") { a = `${hoje.slice(0, 8)}01`; b = hoje; }
  else if (tipo === "custom") { a = deCustom || hoje; b = ateCustom || a; }
  const dias = Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;
  return { a, b, dias, from: paraUtc(a, 0, tz).toISOString(), to: paraUtc(somaDias(b, 1), 0, tz).toISOString() };
}

// ── amostra (só fora de conta conectada) ─────────────────────────────────────────────────────
function amostra(tz, de) {
  const h = (min) => paraUtc(de, min, tz).toISOString();
  return {
    ok: true,
    sales: { count: 14, gross_cents: 198500, discount_cents: 8500, tax_cents: 0, tip_cents: 26400, total_cents: 216400, avg_ticket_cents: 15457 },
    collected_cents: 181400, redeemed_cents: 35000, voided: 1,
    by_method: { cash: 32000, card: 141400, gift_card: 15000, package: 20000, other: 8000 },
    by_kind: { service: 162000, product: 21500, package: 0, giftcard: 15000, tip: 26400, custom: 0 },
    by_pro: [
      { pro_id: "P1", name: "Ana", services_cents: 70000, products_cents: 6400, tips_cents: 12000, commission_cents: 28640 },
      { pro_id: "P2", name: "Bianca", services_cents: 57500, products_cents: 15100, tips_cents: 8400, commission_cents: 24510 },
      { pro_id: "P3", name: "Carla", services_cents: 34500, products_cents: 0, tips_cents: 6000, commission_cents: 13800 },
    ],
    appointments: { booked: 17, completed: 14, no_show: 1, cancelled: 2, unpaid_completed: 1, booked_minutes: 1080 },
    list: [
      { id: "s1", number: 1051, at: h(600), customer: "Maria S.", total_cents: 16800, tip_cents: 2800, status: "paid", methods: ["card"] },
      { id: "s2", number: 1052, at: h(675), customer: "Olivia R.", total_cents: 19500, tip_cents: 3000, status: "paid", methods: ["package", "card"], coupon: "WELCOME10", coupon_discount_cents: 1650 },
      { id: "s3", number: 1053, at: h(720), customer: "Emma W.", total_cents: 6500, tip_cents: 1000, status: "paid", methods: ["cash"] },
      { id: "s4", number: 1054, at: h(780), customer: "Jenny K.", total_cents: 3200, tip_cents: 0, status: "void", methods: ["card"] },
      { id: "s5", number: 1055, at: h(870), customer: "Sofia L.", total_cents: 18000, tip_cents: 1500, status: "paid", methods: ["gift_card", "card"], coupon: "SAVE25", coupon_discount_cents: 2500 },
    ],
    coupons: [{ code: "WELCOME10", uses: 3, discount_cents: 4300 }, { code: "SAVE25", uses: 1, discount_cents: 2500 }],
  };
}

// ── CSV (no navegador) ───────────────────────────────────────────────────────────────────────
const celula = (v) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const reais = (c) => ((Number(c) || 0) / 100).toFixed(2);
function baixarCsv(nome, linhas) {
  const txt = "﻿" + linhas.map((l) => l.map(celula).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const IMPRESSAO = `
@media print {
  body * { visibility: hidden !important; }
  #desk-fechamento-print, #desk-fechamento-print * { visibility: visible !important; }
  #desk-fechamento-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12mm; color: #000 !important; background: #fff !important; }
  #desk-fechamento-print * { color: #000 !important; background: transparent !important; border-color: #bbb !important; box-shadow: none !important; text-shadow: none !important; }
  #desk-fechamento-print .no-print { display: none !important; }
  #desk-fechamento-print .print-only { display: block !important; }
  #desk-fechamento-print table { page-break-inside: auto; }
  #desk-fechamento-print tr { page-break-inside: avoid; }
}
`;

export default function DeskFechamento({ email = "", dataKey = "", conectado = false, agenda = null, loc = null }) {
  const unidades = useMemo(() => (Array.isArray(agenda?.locations) ? agenda.locations : []), [agenda]);
  const [locId, setLocId] = useState(() => loc?.id || "");
  const unidade = unidades.find((l) => l.id === locId) || null;
  const tz = unidade?.tz || loc?.tz || unidades[0]?.tz || TZ_PADRAO;

  const [tipo, setTipo] = useState("today");
  const hojeTz = diaDe(new Date(), tz);
  const [deC, setDeC] = useState(hojeTz);
  const [ateC, setAteC] = useState(hojeTz);
  const per = periodo(tipo, tz, deC, ateC);
  const invalido = per.dias < 1 ? "rangeBad" : per.dias > 92 ? "rangeTooLong" : null;

  const [estado, setEstado] = useState(() => (conectado ? { fase: "lendo", d: null } : { fase: "ok", d: amostra(tz, per.a) }));
  const [seq, setSeq] = useState(0);
  const [ocupado, setOcupado] = useState("");

  useEffect(() => {
    let vivo = true;
    if (invalido) return () => { vivo = false; };
    if (!conectado) { setEstado({ fase: "ok", d: amostra(tz, per.a) }); return () => { vivo = false; }; }
    setEstado((e) => ({ fase: e.d ? "relendo" : "lendo", d: e.d }));
    const corpo = { action: "day_close", from: per.from, to: per.to };
    if (locId) corpo.location_id = locId;
    chamarDesk(email, dataKey, corpo).then(({ d }) => {
      if (!vivo) return;
      if (d?.ok) setEstado({ fase: "ok", d }); else setEstado((e) => ({ fase: "falhou", d: e.d }));
    });
    return () => { vivo = false; };
  }, [conectado, email, dataKey, per.from, per.to, per.a, locId, tz, invalido, seq]);

  const recarregar = useCallback(() => setSeq((n) => n + 1), []);
  const d = estado.d;
  const s = d?.sales || {};
  const bm = d?.by_method || {};
  const ap = d?.appointments || {};
  const porPro = Array.isArray(d?.by_pro) ? d.by_pro : [];
  const lista = Array.isArray(d?.list) ? d.list : [];
  const cupons = Array.isArray(d?.coupons) ? d.coupons : [];
  const soma = (k) => porPro.reduce((acc, p) => acc + (Number(p[k]) || 0), 0);
  const variosDias = per.dias > 1;
  const horaDe = (iso) => quando(iso, tz, variosDias ? { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" } : { hour: "numeric", minute: "2-digit" });
  const diaTxt = (dia, op) => new Date(`${dia}T12:00:00Z`).toLocaleDateString(locale(), { ...op, timeZone: "UTC" });
  const tituloPeriodo = per.a === per.b
    ? diaTxt(per.a, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : `${diaTxt(per.a, { day: "numeric", month: "short" })} – ${diaTxt(per.b, { day: "numeric", month: "short", year: "numeric" })}`;
  const nomeUnidade = unidade?.name || (unidades.length > 1 ? t("allLocations") : unidades[0]?.name || "");

  // ── estorno ────────────────────────────────────────────────────────────────────────────────
  const estornar = async (v) => {
    if (!conectado) { toast(t("sampleBlocked")); return; }
    const aviso = t("voidAsk").replace("{n}", v.number ?? "").replace("{v}", dinheiro(v.total_cents, tz)) + (v.coupon ? `\n${t("voidCoupon").replace("{c}", v.coupon)}` : "");
    if (!window.confirm(aviso)) return;
    const razao = window.prompt(t("voidReason"), "");
    if (razao == null) return;
    if (!razao.trim()) { toast(t("voidNeedReason")); return; }
    setOcupado(v.id);
    const { http, d: r } = await chamarDesk(email, dataKey, { action: "void", id: v.id, reason: razao.trim() });
    setOcupado("");
    if (r?.ok === true) toast(t("voidedOk"));
    else toast(r?.reason === "already_void" ? t("already_void") : motivo(r, http));
    recarregar();
  };

  // ── exportar ───────────────────────────────────────────────────────────────────────────────
  const sufixo = `${per.a}${per.a !== per.b ? `_${per.b}` : ""}${unidade ? `_${unidade.name.replace(/[^\w-]+/g, "-")}` : ""}`;
  const csvVendas = () => {
    if (!lista.length) { toast(t("nothingExport")); return; }
    baixarCsv(`sales_${sufixo}.csv`, [
      [t("number"), t("time"), t("client"), t("methods"), t("coupon"), t("discounts"), t("tips"), t("total"), t("status")],
      ...lista.map((v) => [v.number ?? "", quando(v.at, tz, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }), v.customer || "", metodosDe(v.methods).map(rotuloMetodo).join(" + "), v.coupon || "", v.coupon ? reais(v.coupon_discount_cents) : "", reais(v.tip_cents), reais(v.total_cents), rotuloStatus(v.status)]),
    ]);
  };
  const csvPros = () => {
    if (!porPro.length) { toast(t("nothingExport")); return; }
    baixarCsv(`payroll_${sufixo}.csv`, [
      [t("pro"), t("services"), t("products"), t("tips"), t("commission")],
      ...porPro.map((p) => [p.name || "", reais(p.services_cents), reais(p.products_cents), reais(p.tips_cents), reais(p.commission_cents)]),
      [t("total"), reais(soma("services_cents")), reais(soma("products_cents")), reais(soma("tips_cents")), reais(soma("commission_cents"))],
    ]);
  };

  const btn = "rounded-full border border-white/15 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word hover:bg-white/[0.06] disabled:opacity-40";
  const pill = (ativo) => `shrink-0 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] rounded-full text-xs font-bold whitespace-nowrap ${ativo ? "bg-g-green/20 text-g-word" : "text-g-muted hover:text-g-word"}`;
  const campoData = "min-w-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs text-g-word [color-scheme:dark]";

  return (
    <div id="desk-fechamento-print" className="space-y-4">
      <style>{IMPRESSAO}</style>

      {/* cabeçalho só de impressão */}
      <div className="print-only hidden">
        <div className="text-xl font-extrabold">{t("closeTitle")}</div>
        <div className="text-sm">{tituloPeriodo}{nomeUnidade ? ` · ${nomeUnidade}` : ""}</div>
        <div className="text-[11px]">{t("printedAt")} {quando(new Date().toISOString(), tz)}</div>
      </div>

      {/* controles */}
      <div className="no-print space-y-3">
        <p className="text-xs text-g-muted max-w-md">{t("sub")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-x-auto rounded-full border border-white/10 bg-white/[0.04] p-0.5 max-w-full" role="tablist">
            {["today", "yesterday", "week", "month", "custom"].map((k) => (
              <button key={k} role="tab" aria-selected={tipo === k} onClick={() => setTipo(k)} className={pill(tipo === k)}>{t(k)}</button>
            ))}
          </div>
          {tipo === "custom" && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-g-muted">
              <label className="flex items-center gap-1">{t("from")}<input type="date" value={deC} max={hojeTz} onChange={(e) => e.target.value && setDeC(e.target.value)} className={campoData} /></label>
              <label className="flex items-center gap-1">{t("to")}<input type="date" value={ateC} max={hojeTz} onChange={(e) => e.target.value && setAteC(e.target.value)} className={campoData} /></label>
            </div>
          )}
          {unidades.length > 1 && (
            <select value={locId} onChange={(e) => setLocId(e.target.value)} aria-label={t("allLocations")}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word [color-scheme:dark]">
              <option value="">{t("allLocations")}</option>
              {unidades.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <button onClick={csvVendas} disabled={!d} className={btn}>⬇ {t("exportSales")}</button>
            <button onClick={csvPros} disabled={!d} className={btn}>⬇ {t("exportPros")}</button>
            <button onClick={() => window.print()} disabled={!d} className={btn}>🖨 {t("print")}</button>
          </div>
        </div>
        <div className="text-sm font-bold text-g-word capitalize">{tituloPeriodo}{nomeUnidade ? <span className="text-g-muted font-normal normal-case"> · {nomeUnidade}</span> : null}</div>
      </div>

      {!conectado && <div className="no-print rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] px-4 py-2.5 text-xs text-g-light">{t("sample")}</div>}
      {invalido && <div role="alert" className="no-print rounded-xl2 border border-amber-400/40 bg-amber-400/[0.08] px-4 py-2.5 text-xs text-amber-200">{t(invalido)}</div>}
      {estado.fase === "falhou" && (
        <div role="alert" className="no-print flex items-center justify-between gap-3 rounded-xl2 border border-red-400/30 bg-red-400/[0.06] px-4 py-2.5 text-xs text-red-300">
          <span>{t("readFail")}</span>
          <button onClick={recarregar} className="font-bold text-g-word underline">{t("retry")}</button>
        </div>
      )}

      {!invalido && estado.fase === "lendo" && <SectionSkeleton rows={5} />}

      {!invalido && d && (
        <div className={`space-y-4 ${estado.fase === "relendo" ? "opacity-70 transition-opacity" : ""}`}>
          {/* dinheiro que entrou */}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Card tone="green">
              <div className="relative">
                <div className="text-[11px] uppercase tracking-wide text-g-muted">{t("moneyIn")}</div>
                <div className="mt-1 text-4xl sm:text-5xl font-black num text-g-green money-glow">{dinheiro(d.collected_cents, tz)}</div>
                <div className="mt-1 text-[11px] text-g-muted">{t("moneyInHelp")}</div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {["cash", "card", "other"].map((m) => (
                    <div key={m} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-g-muted">{t(m)}</div>
                      <div className="text-base font-extrabold num text-g-word">{dinheiro(bm[m], tz)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card tone="gold">
              <div className="relative">
                <div className="text-[11px] uppercase tracking-wide text-g-muted">{t("prepaid")}</div>
                <div className="mt-1 text-2xl font-extrabold num text-g-gold">{dinheiro(d.redeemed_cents, tz)}</div>
                <div className="mt-1 text-[11px] text-g-muted">{t("prepaidHelp")}</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {["gift_card", "package"].map((m) => (
                    <div key={m} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-g-muted">{t(m)}</div>
                      <div className="text-sm font-extrabold num text-g-word">{dinheiro(bm[m], tz)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* números da venda */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
            {[
              ["gross", dinheiro(s.gross_cents, tz)], ["discounts", s.discount_cents ? `−${dinheiro(s.discount_cents, tz)}` : dinheiro(0, tz)],
              ["tax", dinheiro(s.tax_cents, tz)], ["tips", dinheiro(s.tip_cents, tz)], ["avgTicket", dinheiro(s.avg_ticket_cents, tz)],
              ["salesCount", s.count ?? 0], ["voided", d.voided ?? 0],
            ].map(([k, v]) => (
              <Card key={k} className="!p-3">
                <div className="text-[10px] uppercase tracking-wide text-g-muted">{t(k)}</div>
                <div className={`text-base font-extrabold num mt-0.5 ${k === "voided" && Number(v) > 0 ? "text-red-300" : "text-g-word"}`}>{v}</div>
              </Card>
            ))}
          </div>

          {/* cupons usados no período (desk_v14) — só aparece quando houve cupom */}
          {cupons.length > 0 && (
            <Card className="!p-4">
              <div className="text-sm font-extrabold text-g-word"><span aria-hidden className="mr-1.5">🏷</span>{t("coupons")}</div>
              <div className="text-[11px] text-g-muted">{t("couponsHelp")}</div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {cupons.map((c) => (
                  <div key={c.code} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-black tracking-wider text-g-word num truncate">{c.code}</div>
                      <div className="text-[11px] text-g-muted num">{c.uses} {Number(c.uses) === 1 ? t("use1") : t("uses")}</div>
                    </div>
                    <div className="text-sm font-extrabold num text-g-word">−{dinheiro(c.discount_cents, tz)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* atendimentos */}
          <Card className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-extrabold text-g-word">{t("appointments")}</div>
              {(Number(ap.unpaid_completed) || 0) > 0 && (
                <span role="alert" className="rounded-full border border-amber-400/50 bg-amber-400/[0.12] px-3 py-1 text-[11px] font-bold text-amber-200">
                  ⚠️ {Number(ap.unpaid_completed) === 1 ? t("unpaid1") : t("unpaid").replace("{n}", ap.unpaid_completed)}
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[["booked", ap.booked, "#3FB4FF"], ["completed", ap.completed, "#2FE39A"], ["noShows", ap.no_show, "#FF5A5A"], ["cancelled", ap.cancelled, "#8E8A80"]].map(([k, v, c]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-g-muted">{t(k)}</div>
                  <div className="text-lg font-extrabold num" style={{ color: c }}>{v ?? 0}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* por profissional — a folha */}
          <div className="rounded-xl2 border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="text-sm font-extrabold text-g-word">{t("byPro")}</div>
              <div className="text-[11px] text-g-muted">{t("byProHelp")}</div>
            </div>
            {porPro.length === 0 ? <div className="px-4 py-8 text-center text-xs text-g-muted">{t("noPros")}</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-g-muted">
                      <th className="px-4 py-2 text-left font-bold">{t("pro")}</th>
                      <th className="px-4 py-2 text-right font-bold">{t("services")}</th>
                      <th className="px-4 py-2 text-right font-bold">{t("products")}</th>
                      <th className="px-4 py-2 text-right font-bold">{t("tips")}</th>
                      <th className="px-4 py-2 text-right font-bold">{t("commission")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {porPro.map((p) => (
                      <tr key={p.pro_id || p.name}>
                        <td className="px-4 py-2 font-bold text-g-word">{p.name || "—"}</td>
                        <td className="px-4 py-2 text-right num text-g-word">{dinheiro(p.services_cents, tz)}</td>
                        <td className="px-4 py-2 text-right num text-g-word">{dinheiro(p.products_cents, tz)}</td>
                        <td className="px-4 py-2 text-right num text-g-word">{dinheiro(p.tips_cents, tz)}</td>
                        <td className="px-4 py-2 text-right num font-extrabold text-g-green">{dinheiro(p.commission_cents, tz)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/15 bg-white/[0.03]">
                      <td className="px-4 py-2 font-extrabold text-g-word">{t("total")}</td>
                      <td className="px-4 py-2 text-right num font-extrabold text-g-word">{dinheiro(soma("services_cents"), tz)}</td>
                      <td className="px-4 py-2 text-right num font-extrabold text-g-word">{dinheiro(soma("products_cents"), tz)}</td>
                      <td className="px-4 py-2 text-right num font-extrabold text-g-word">{dinheiro(soma("tips_cents"), tz)}</td>
                      <td className="px-4 py-2 text-right num font-extrabold text-g-green">{dinheiro(soma("commission_cents"), tz)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* lista de vendas */}
          <div className="rounded-xl2 border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 text-sm font-extrabold text-g-word">{t("salesList")} <span className="text-g-muted font-bold num">{lista.length}</span></div>
            {lista.length === 0 ? <div className="px-4 py-8 text-center text-xs text-g-muted">{t("noSales")}</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-g-muted">
                      <th className="px-4 py-2 text-left font-bold">{t("number")}</th>
                      <th className="px-4 py-2 text-left font-bold">{t("time")}</th>
                      <th className="px-4 py-2 text-left font-bold">{t("client")}</th>
                      <th className="px-4 py-2 text-left font-bold">{t("methods")}</th>
                      <th className="px-4 py-2 text-right font-bold">{t("total")}</th>
                      <th className="px-4 py-2 text-left font-bold">{t("status")}</th>
                      <th className="px-4 py-2 no-print" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {lista.map((v) => {
                      const morta = anulada(v.status);
                      return (
                        <tr key={v.id} className={morta ? "opacity-60" : ""}>
                          <td className="px-4 py-2 num text-g-muted whitespace-nowrap">#{v.number ?? "—"}</td>
                          <td className="px-4 py-2 num text-g-word whitespace-nowrap">{horaDe(v.at)}</td>
                          <td className="px-4 py-2 font-bold text-g-word">{v.customer || "—"}</td>
                          <td className="px-4 py-2 text-xs text-g-muted">{metodosDe(v.methods).map(rotuloMetodo).join(" + ") || "—"}</td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <div className={`num font-extrabold ${morta ? "line-through text-g-muted" : "text-g-word"}`}>{dinheiro(v.total_cents, tz)}</div>
                            {v.tip_cents ? <div className="text-[10px] font-bold text-g-muted num">{t("tips")} {dinheiro(v.tip_cents, tz)}</div> : null}
                            {v.coupon ? <div className="text-[10px] font-bold text-g-muted num">🏷 {v.coupon} −{dinheiro(v.coupon_discount_cents, tz)}</div> : null}
                          </td>
                          <td className={`px-4 py-2 text-xs font-bold whitespace-nowrap ${morta ? "text-red-300" : "text-g-green"}`}>{rotuloStatus(v.status)}</td>
                          <td className="px-4 py-2 text-right no-print">
                            {!morta && (
                              <button onClick={() => estornar(v)} disabled={!!ocupado}
                                className="rounded-full border border-red-400/40 px-3 py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-[11px] font-bold text-red-300 hover:bg-red-400/10 disabled:opacity-40">
                                {ocupado === v.id ? "…" : t("void")}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

