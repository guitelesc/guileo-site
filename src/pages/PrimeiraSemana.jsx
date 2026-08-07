// /primeira-semana — O QUE VOCÊ RECEBE, DE VERDADE.
//
// POR QUE EXISTE: a landing vende a visão. Esta página vende a ENTREGA — e é o
// material que o vendedor abre na frente do cliente. Por isso ela lista só o que
// está no ar HOJE, e diz em voz alta o que ainda não está.
//
// Prometer SMS/WhatsApp antes de acenderem seria ganhar a assinatura e perder o
// cliente na primeira semana. Um "ainda não" dito antes da venda é honestidade;
// depois da venda é desculpa. Quando o A2P aprovar e o app Meta for publicado,
// as linhas ⏳ viram ✅ aqui e no produto ao mesmo tempo.
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";

const C = {
  pt: {
    eyebrow: "O que você recebe",
    h1: "Sua primeira semana com a Gui",
    sub: "Sem promessa vaga. Isto é o que já está funcionando, e o que ainda não está.",
    liveHead: "No ar desde o dia 1",
    soonHead: "Ainda não — e a gente avisa quando ligar",
    soonNote: "Isso depende de aprovação de operadora e da Meta, não de nós. Você não paga por isso enquanto não estiver no ar.",
    dayHead: "Como corre a semana",
    days: [
      ["Dia 1", "Você paga e a Gui nasce: nome do seu negócio, sua voz, seus serviços e preços. Sem reunião de setup."],
      ["Dia 2", "Você aponta seu telefone pra ela (ou a gente aponta). A partir daí, nenhuma ligação cai no vazio."],
      ["Dia 3–4", "Ela aprende com as primeiras ligações. Você ajusta o que ela fala direto no painel."],
      ["Dia 5–7", "Primeiros agendamentos e orçamentos entrando sozinhos. Você vê tudo no cockpit, com nome e horário."],
    ],
    guaranteeHead: "Se não valer a pena",
    guarantee: "30 dias de garantia. Você pede o dinheiro de volta e a gente devolve — sem discussão e sem letra miúda.",
    cta: "Quero começar",
    ctaSub: "Planos a partir de $149/mês",
  },
  en: {
    eyebrow: "What you get",
    h1: "Your first week with Gui",
    sub: "No vague promises. This is what already works — and what doesn't yet.",
    liveHead: "Live from day 1",
    soonHead: "Not yet — we'll tell you the day it turns on",
    soonNote: "These wait on carrier and Meta approval, not on us. You don't pay for them until they're live.",
    dayHead: "How the week runs",
    days: [
      ["Day 1", "You pay and Gui is born: your business name, your voice, your services and prices. No setup meeting."],
      ["Day 2", "You point your phone line at her (or we do). From then on, no call goes unanswered."],
      ["Day 3–4", "She learns from the first calls. You adjust what she says, right in your dashboard."],
      ["Day 5–7", "First bookings and quotes come in on their own. You see it all in the cockpit, with names and times."],
    ],
    guaranteeHead: "If it isn't worth it",
    guarantee: "30-day money-back guarantee. You ask, we refund — no argument, no fine print.",
    cta: "Get started",
    ctaSub: "Plans from $149/mo",
  },
};

// A verdade da plataforma em 2026-08-04. Mexer aqui quando um canal acender.
const LIVE = {
  pt: [
    ["📞", "Atende o telefone 24/7", "Nunca dá ocupado, nunca cai na caixa postal. Atende várias ligações ao mesmo tempo."],
    ["🗓️", "Agenda de verdade", "Marca, remarca e cancela na hora, sem furar horário — e cai na sua agenda."],
    ["💬", "Chat no seu site", "Responde quem chega pelo site, com os seus preços e horários."],
    ["✉️", "E-mail automático", "Confirmação, lembrete e follow-up saem com a sua marca."],
    ["🌎", "Fala a língua do cliente", "Inglês, português e espanhol — troca sozinha, no meio da frase."],
    ["💳", "Fecha e cobra na ligação", "Manda o link de pagamento e o dinheiro cai na SUA conta."],
    ["📊", "Painel com a verdade", "Cada ligação, lead e agendamento, com nome e hora. Nada inventado."],
    ["🌐", "Site do seu negócio", "No ar, com seus serviços e preços — e a Gui atendendo dentro dele."],
  ],
  en: [
    ["📞", "Answers the phone 24/7", "Never busy, never voicemail. Handles several calls at once."],
    ["🗓️", "Real scheduling", "Books, reschedules and cancels on the spot — no double-booking."],
    ["💬", "Chat on your website", "Answers visitors with your real prices and hours."],
    ["✉️", "Automatic email", "Confirmations, reminders and follow-ups, in your brand."],
    ["🌎", "Speaks your customer's language", "English, Portuguese and Spanish — switches mid-sentence."],
    ["💳", "Closes and collects on the call", "Sends the payment link; the money lands in YOUR account."],
    ["📊", "A dashboard that tells the truth", "Every call, lead and booking, with names and times. Nothing invented."],
    ["🌐", "A website for your business", "Live, with your services and prices — and Gui answering inside it."],
  ],
};

const SOON = {
  pt: [
    ["📲", "SMS e retorno de chamada perdida", "Esperando aprovação da operadora americana (A2P). Submetido."],
    ["🟢", "WhatsApp respondendo sozinho", "Já recebe; falta a Meta liberar o envio."],
  ],
  en: [
    ["📲", "SMS and missed-call text-back", "Waiting on US carrier approval (A2P). Submitted."],
    ["🟢", "WhatsApp answering on its own", "Already receives; waiting on Meta to allow sending."],
  ],
};

export default function PrimeiraSemana() {
  const { lang } = useLang();
  const L = (lang || "en").startsWith("pt") ? "pt" : "en";
  const t = C[L];
  useSeo({
    title: L === "pt" ? "Sua primeira semana com a Gui | Guileo" : "Your first week with Gui | Guileo",
    description: t.sub, path: "/primeira-semana",
  });

  const Card = ({ icon, title, body, dim }) => (
    <div className={`rounded-xl2 border p-5 ${dim ? "border-white/10 bg-white/[0.02]" : "border-g-line bg-white/[0.04]"}`}>
      <div className="text-2xl">{icon}</div>
      <div className={`mt-2 font-bold ${dim ? "text-g-muted" : "text-g-word"}`}>{title}</div>
      <p className="mt-1 text-[13.5px] leading-relaxed text-g-ink">{body}</p>
    </div>
  );

  return (
    <main className="px-5 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{t.eyebrow}</div>
        <h1 className="mt-3 font-black leading-[1.03] tracking-tight text-g-word" style={{ fontSize: "clamp(2rem,5vw,3.2rem)" }}>{t.h1}</h1>
        <p className="mx-auto mt-4 max-w-xl text-[15.5px] text-g-ink">{t.sub}</p>
      </div>

      <section className="mx-auto mt-14 max-w-5xl">
        <h2 className="mb-5 text-[13px] font-bold uppercase tracking-[0.2em] text-g-green">✅ {t.liveHead}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LIVE[L].map(([i, ti, b]) => <Card key={ti} icon={i} title={ti} body={b} />)}
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-5xl">
        <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.2em] text-g-muted">⏳ {t.soonHead}</h2>
        <p className="mb-5 max-w-2xl text-[13.5px] text-g-ink">{t.soonNote}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOON[L].map(([i, ti, b]) => <Card key={ti} icon={i} title={ti} body={b} dim />)}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-3xl">
        <h2 className="mb-5 text-[13px] font-bold uppercase tracking-[0.2em] text-g-gold">{t.dayHead}</h2>
        <ol className="space-y-3">
          {t.days.map(([d, b]) => (
            <li key={d} className="rounded-xl2 border border-g-line bg-white/[0.03] p-5">
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-green">{d}</div>
              <p className="mt-1 text-[14.5px] leading-relaxed text-g-word">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-12 max-w-2xl rounded-xl3 border border-g-green/30 bg-g-green/[0.06] p-7 text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-g-green">🛡️ {t.guaranteeHead}</div>
        <p className="mt-2 text-[15px] leading-relaxed text-g-word">{t.guarantee}</p>
        <a href="/planos" className="mt-6 inline-block rounded-full bg-gradient-to-r from-g-green to-g-dark px-7 py-3.5 text-[15px] font-bold text-white">{t.cta} →</a>
        <div className="mt-2 text-[12.5px] text-g-muted">{t.ctaSub}</div>
      </section>
    </main>
  );
}
