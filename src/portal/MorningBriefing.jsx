/* MorningBriefing — the top-of-Overview "☀️ Good morning" card. A factual one-liner built
   ENTIRELY client-side from data the Overview already has (the real event ledger, or the demo
   numbers) — no new endpoint. Yesterday's calls/bookings/collected + today's bookings, greeted
   by the hour of day, in the portal language. Honest empty states when there's nothing yet. */
import { useState, useEffect } from "react";
import { tr, UI_LANG, vnum } from "../pages/Portal.jsx";
import { portalApi, loadDataKey } from "../lib/portalApi.js";

const L = () => (["en", "pt", "es", "hi"].includes(UI_LANG) ? UI_LANG : "en");

// Hour-of-day greeting + emoji, localized (pt/en/es/hi).
function greeting() {
  const h = new Date().getHours();
  const slot = h < 12 ? 0 : h < 19 ? 1 : 2;      // 0 morning · 1 afternoon · 2 evening
  const emoji = ["☀️", "🌤️", "🌙"][slot];
  const l = L();
  const g = {
    en: ["Good morning", "Good afternoon", "Good evening"],
    pt: ["Bom dia", "Boa tarde", "Boa noite"],
    es: ["Buenos días", "Buenas tardes", "Buenas noches"],
    hi: ["सुप्रभात", "नमस्ते", "शुभ संध्या"],
  }[l][slot];
  return { emoji, g };
}

// [start, end) epoch bounds for yesterday and today (local time).
function bounds() {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYtd = startToday - 864e5;
  return { startYtd, startToday, now: now.getTime() };
}

// O que o cliente PAGA à Guileo (plano, recarga de crédito) não é dinheiro que ele recebeu.
// Mesmo critério do `isGuileoPayment` da Visão geral — repetido aqui porque o Overview importa
// este arquivo, e importar de volta fecharia um ciclo.
const pagoAGuileo = (e) =>
  !!e && e.type === "payment" && !/^💳/.test(e.summary || "") && (
    /stripe|mercado\s?pago|mercadopago|system|billing/i.test(e.channel || "") ||
    /plan|subscription|assinat|recarga|top-?up|credit|cr[eé]dito|renew|invoice guileo/i.test(e.summary || "") ||
    !(e.channel || "").trim()
  );

// Real stats from the event ledger; demo stats from stable per-tenant demo numbers.
// `agendaHoje`: número de agendamentos de HOJE lido da agenda (biz_appointments), ou null quando
// a agenda não foi lida (ainda carregando / falhou) — null some da frase, nunca vira zero.
function computeStats(V, real, agendaHoje = null) {
  if (real && Array.isArray(real.events)) {
    const { startYtd, startToday } = bounds();
    const ev = real.events;
    const inWin = (e, a, b) => { const t = new Date(e.created_at).getTime(); return Number.isFinite(t) && t >= a && t < b; };
    // ligação PERDIDA (📵 no resumo) também é type "call" — não entra em "calls answered"
    const ydCalls = ev.filter((e) => e.type === "call" && !(e.summary || "").includes("📵") && inWin(e, startYtd, startToday)).length;
    const ydBookings = ev.filter((e) => e.type === "booking" && inWin(e, startYtd, startToday)).length;
    // 🚨 "COLLECTED" SOMAVA TUDO (2026-09-28): o valor de QUALQUER evento de ontem entrava na
    // conta — o orçamento citado numa ligação, o valor estimado de um lead, a mensalidade que a
    // cliente pagou À GUILEO. "Recebido" é só evento de pagamento/venda, e nunca o que ela nos paga.
    // Piso em 0 para um estorno não virar "-$40".
    const ydMoney = Math.max(0, Math.round(ev.filter((e) => (e.type === "payment" || e.type === "sale") && !pagoAGuileo(e) && inWin(e, startYtd, startToday)).reduce((s, e) => s + (Number(e.amount) || 0), 0)));
    const any = ydCalls || ydBookings || ydMoney || (agendaHoje || 0);
    return { ydCalls, ydBookings, ydMoney, todayBookings: agendaHoje, real: true, any };
  }
  // Demo — stable sample numbers (same seed the rest of the demo dashboard uses).
  const label = V.label;
  return {
    ydCalls: vnum(label, "mbf_calls", 6, 28),
    ydBookings: vnum(label, "mbf_book", 2, 11),
    ydMoney: vnum(label, "mbf_money", 180, 1400),
    todayBookings: (V.ops?.schedule?.length) || vnum(label, "mbf_today", 3, 9),
    real: false, any: true,
  };
}

// Build the localized "Ontem: … Hoje: …" sentence.
function sentence(s) {
  const l = L();
  const money = `$${s.ydMoney.toLocaleString()}`;
  if (!s.any) {
    // honest quiet-day state (real mode, nothing yesterday, nothing today yet)
    return l === "pt" ? "Ontem foi tranquilo — nada registrado ainda. Vamos fazer hoje render. 🌱"
      : l === "es" ? "Ayer estuvo tranquilo — aún sin registros. Hagamos que hoy rinda. 🌱"
      : l === "hi" ? "कल शांत रहा — अभी कोई रिकॉर्ड नहीं। आज को बेहतर बनाते हैं। 🌱"
      : "Yesterday was quiet — nothing logged yet. Let's make today count. 🌱";
  }
  // 🚨 "Today: 0 appointments" SAÍA DOS EVENTOS, NÃO DA AGENDA (2026-09-28): contava quantos
  // agendamentos a Gui CRIOU hoje e chamava isso de "agendamentos de hoje". Quem tinha três
  // clientes marcados para hoje (marcados na semana passada) lia zero. Agora o número vem da
  // agenda; se a agenda não foi lida (`null`), a frase termina em ontem — não inventa o hoje.
  const n = s.todayBookings;
  // "Ainda hoje": /api/appointments lista os PRÓXIMOS — quem já foi atendido de manhã não entra,
  // então a frase fala do que ainda vem, não do dia inteiro.
  const hoje = n == null ? "" : l === "pt" ? ` Ainda hoje na agenda: ${n} ${n === 1 ? "agendamento" : "agendamentos"}.`
    : l === "es" ? ` Aún hoy en la agenda: ${n} ${n === 1 ? "cita" : "citas"}.`
    : l === "hi" ? ` आज आगे शेड्यूल में: ${n} अपॉइंटमेंट।`
    : ` Still coming up today: ${n} ${n === 1 ? "appointment" : "appointments"}.`;
  if (l === "pt") return `Ontem: ${s.ydCalls} ligações atendidas, ${s.ydBookings} agendamentos feitos, ${money} recebidos.${hoje}`;
  if (l === "es") return `Ayer: ${s.ydCalls} llamadas atendidas, ${s.ydBookings} reservas hechas, ${money} cobrados.${hoje}`;
  if (l === "hi") return `कल: ${s.ydCalls} कॉल उठाए, ${s.ydBookings} बुकिंग की गईं, ${money} प्राप्त हुए।${hoje}`;
  return `Yesterday: ${s.ydCalls} calls answered, ${s.ydBookings} bookings made, ${money} collected.${hoje}`;
}

function MorningBriefing({ V, real = null, email = "", dataKey = "" }) {
  const { emoji, g } = greeting();
  // Agenda de hoje — lida de /api/appointments (a fonte da verdade, biz_appointments). Hook ANTES
  // de qualquer return. null = não sei (lendo ou falhou); número = contei.
  const [agendaHoje, setAgendaHoje] = useState(null);
  const temReal = !!real;
  useEffect(() => {
    let vivo = true;
    const chave = dataKey || loadDataKey();
    if (!temReal || !email || !chave) { setAgendaHoje(null); return () => { vivo = false; }; }
    (async () => {
      let n = null;
      try {
        const r = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, key: chave }) });
        const d = r.ok ? await r.json().catch(() => null) : null;
        if (d && !d.error && !d.erro && d.ok !== false && Array.isArray(d.appointments)) {
          const { startToday, now } = bounds();
          n = d.appointments.filter((a) => { const t = new Date(a.when).getTime(); return Number.isFinite(t) && t >= now && t < startToday + 864e5 && !/cancel/i.test(a.status || ""); }).length;
        }
      } catch { n = null; }
      if (vivo) setAgendaHoje(n);
    })();
    return () => { vivo = false; };
  }, [temReal, email, dataKey]);
  // 🚨 CONTA REAL SEM DADO LIDO NÃO RECEBE AMOSTRA (2026-09-27). Sem `real`, o cartão caía no ramo
  // de demonstração e dizia à dona do negócio "Ontem: 17 ligações, 6 reservas, $940" — números do
  // `vnum()`, gerados por semente, com o nome dela em cima. O selinho "sample" ao lado não salva:
  // ninguém lê selo cinza de 9px depois de ler "$940".
  // Conta real sem leitura = estado vazio honesto. E a frase depende do PORQUÊ: sem chave é
  // "conecte"; com chave e sem leitura é "não consegui ler" — culpar quem já colou a chave foi o
  // defeito de 2026-08-20. A vitrine (demo) segue igual: lá a amostra É o produto.
  if (!real && portalApi.contaReal()) {
    const temChave = !!loadDataKey();
    return (
      <div className="rounded-xl2 border border-g-gold/25 bg-gradient-to-br from-g-gold/[0.08] to-transparent px-4 py-3 flex items-start gap-3">
        <span className="text-xl shrink-0 leading-none mt-0.5" aria-hidden>{emoji}</span>
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-g-word">{g}!</div>
          <div className="text-xs text-g-muted mt-0.5 leading-snug">
            {temChave ? tr("I couldn't refresh your data just now.") : tr("Connect your code to see your real numbers")}
            {" "}
            <a href="/portal?tab=settings" className="font-bold text-g-light hover:text-g-word transition">{tr("Open Settings →")}</a>
          </div>
        </div>
      </div>
    );
  }
  const stats = computeStats(V, real, agendaHoje);
  return (
    <div className="rounded-xl2 border border-g-gold/25 bg-gradient-to-br from-g-gold/[0.08] to-transparent px-4 py-3 flex items-start gap-3">
      <span className="text-xl shrink-0 leading-none mt-0.5" aria-hidden>{emoji}</span>
      <div className="min-w-0">
        <div className="text-sm font-extrabold text-g-word flex items-center gap-2">
          {g}!
          {stats.real
            ? <span className="inline-flex items-center gap-1 text-[9px] font-black text-g-green normal-case"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-[9px] font-black text-g-muted normal-case">{tr("sample")}</span>}
        </div>
        <div className="text-xs text-g-muted mt-0.5 leading-snug">{sentence(stats)}</div>
      </div>
    </div>
  );
}

export default MorningBriefing;
