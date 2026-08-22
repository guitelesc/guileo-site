import { useState } from "react";
import ConsentText from "../components/ConsentText.jsx";
import LeadForm from "../components/LeadForm.jsx";
import { useLang } from "../i18n.jsx";

// /sms — A PÁGINA QUE O REVISOR DA OPERADORA ABRE.
//
// POR QUE EXISTE: a campanha A2P 10DLC foi reprovada com o erro 30909 — "não foi possível
// verificar o Call to Action (CTA)", campo MESSAGE_FLOW. O texto de consentimento do site já
// estava completo (ConsentText.jsx, corrigido em 03/08) — o problema é ONDE ele vive: dentro
// de uma landing longa, depois de muito scroll. O revisor abre a URL declarada, não acha o
// opt-in em segundos, e reprova.
//
// Esta página resolve isso sendo exatamente uma coisa: a prova pública, estática e imediata de
// como alguém consente em receber mensagem. Sem hero, sem venda, sem scroll. É o link que vai
// no campo "Message Flow" da campanha.
//
// A caixa aqui é uma AMOSTRA (desabilitada) do formulário real — mostra o estado desmarcado por
// padrão, que é o que a operadora exige ver. Quem quiser de fato se cadastrar usa o link para o
// formulário real; duplicar o envio aqui criaria um segundo caminho de captura pra manter.

export default function SmsOptIn() {
  const { lang } = useLang();
  const [amostra, setAmostra] = useState(false);

  const T = {
    en: {
      eyebrow: "SMS program · opt-in",
      h1: "How you sign up for messages from Guileo",
      intro: "Guileo only sends text messages to people who ask for them. This page shows exactly how that consent is collected.",
      stepsH: "How someone opts in",
      steps: [
        "They fill in the form at the bottom of this page — or the same form on guileoai.com — with their name and phone number.",
        "They tick the consent box below. It is UNCHECKED by default — the form cannot be submitted without it.",
        "They press “Get started”. Only then is the number added, and only for the messages described here.",
      ],
      sampleH: "The consent box, exactly as it appears on the form",
      whatH: "What we send",
      what: [
        ["Appointment confirmations and reminders", "after you book with a business that uses Guileo"],
        ["A reply when you contact a business and no one could pick up", "so you are not left waiting"],
        ["A secure payment link", "only when you ask for one on a call"],
      ],
      freqH: "Frequency, cost and how to stop",
      freq: [
        "Message frequency varies — it depends on the appointments and requests you make.",
        "Message and data rates may apply, charged by your carrier.",
        "Reply STOP at any time to stop receiving messages. Reply HELP for help.",
      ],
      ctaH: "Want to sign up?",
      cta: "Go to the form",
      legal: "Legal",
    },
    pt: {
      eyebrow: "Programa de SMS · consentimento",
      h1: "Como você aceita receber mensagens da Guileo",
      intro: "A Guileo só envia mensagem para quem pediu. Esta página mostra exatamente como esse consentimento é coletado.",
      stepsH: "Como a pessoa dá o consentimento",
      steps: [
        "Ela preenche o formulário no fim desta página — ou o mesmo formulário em guileoai.com — com nome e telefone.",
        "Ela marca a caixa de consentimento abaixo. Ela vem DESMARCADA — sem marcar, o formulário não envia.",
        "Ela clica em “Começar”. Só então o número passa a receber as mensagens descritas aqui.",
      ],
      sampleH: "A caixa de consentimento, exatamente como aparece no formulário",
      whatH: "O que enviamos",
      what: [
        ["Confirmação e lembrete de agendamento", "depois que você marca com um negócio que usa a Guileo"],
        ["Uma resposta quando você procura um negócio e ninguém pôde atender", "para você não ficar esperando"],
        ["Um link de pagamento seguro", "só quando você pede na ligação"],
      ],
      freqH: "Frequência, custo e como sair",
      freq: [
        "A frequência varia — depende dos agendamentos e pedidos que você fizer.",
        "Podem incidir tarifas de mensagem e dados, cobradas pela sua operadora.",
        "Responda STOP a qualquer momento para parar de receber. Responda HELP para ajuda.",
      ],
      ctaH: "Quer se cadastrar?",
      cta: "Ir para o formulário",
      legal: "Jurídico",
    },
  };
  const t = T[lang === "pt" ? "pt" : "en"];

  return (
    <main className="mx-auto max-w-2xl px-5 py-20">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-g-gold">{t.eyebrow}</div>
      <h1 className="mt-3 text-[34px] font-black leading-tight tracking-tight text-g-word">{t.h1}</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-g-ink">{t.intro}</p>

      <h2 className="mt-10 text-[13px] font-bold uppercase tracking-wider text-g-muted">{t.stepsH}</h2>
      <ol className="mt-3 space-y-3">
        {t.steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-g-ink">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[12px] font-bold text-g-word ring-1 ring-white/10">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      {/* A AMOSTRA. Desmarcada por padrão — é este estado que a operadora precisa ver. */}
      <h2 className="mt-10 text-[13px] font-bold uppercase tracking-wider text-g-muted">{t.sampleH}</h2>
      <div className="mt-3 rounded-2xl border border-g-line bg-white/[0.04] p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={amostra} onChange={(e) => setAmostra(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-g-green" aria-label="consent sample" />
          <span className="text-[13.5px] leading-relaxed text-g-ink"><ConsentText /></span>
        </label>
      </div>

      <h2 className="mt-10 text-[13px] font-bold uppercase tracking-wider text-g-muted">{t.whatH}</h2>
      <ul className="mt-3 space-y-2.5">
        {t.what.map(([a, b], i) => (
          <li key={i} className="text-[15px] leading-relaxed text-g-ink">
            <span className="font-semibold text-g-word">{a}</span> — {b}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-[13px] font-bold uppercase tracking-wider text-g-muted">{t.freqH}</h2>
      <ul className="mt-3 space-y-2.5">
        {t.freq.map((s, i) => <li key={i} className="text-[15px] leading-relaxed text-g-ink">{s}</li>)}
      </ul>

      {/* O FORMULÁRIO DE VERDADE, NESTA PÁGINA (2026-08-22).
          A versão anterior mandava o revisor para /#contact. Foi por isso que a campanha
          reprovou de novo com 30909 (MESSAGE_FLOW): o revisor tem que VER e CONSEGUIR USAR o
          opt-in na URL declarada — mandar para outro lugar é a mesma caçada que reprovou antes.
          Não é um segundo caminho de captura: é o MESMO <LeadForm/> da home, só que aqui
          também. Uma fonte, dois lugares — a duplicação que preocupava não acontece. */}
      <div className="mt-12 rounded-2xl border border-g-line bg-white/[0.04] p-6">
        <div className="text-[15px] font-bold text-g-word">{t.ctaH}</div>
        <div className="mt-5"><LeadForm source="sms-optin" canal="phone" /></div>
      </div>

      <div className="mt-8 text-[13px] text-g-muted">
        {t.legal}: <a href="/privacy" className="text-g-gold hover:underline">Privacy Policy</a>
        <span className="mx-2 text-g-faint">·</span>
        <a href="/terms" className="text-g-gold hover:underline">Terms of Service</a>
      </div>
    </main>
  );
}
