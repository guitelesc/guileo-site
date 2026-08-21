// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT FACTS — a ÚNICA fonte da verdade do produto para TODOS os cérebros de IA
// (gui-chat da landing, Gui Suporte, copiloto de ativação, pitch-ai do vendedor,
// widget-chat, cérebro de voz). Mudou o produto → muda AQUI e todos os agentes
// passam a falar a verdade nova no mesmo deploy. É a ROTA-SINCRONIA em código.
//
// REGRA: nada aqui pode prometer o que o produto não faz. Preços espelham
// src/data/guileoPlans.js (fonte canônica de planos) — se mudar lá, mude aqui.
// ─────────────────────────────────────────────────────────────────────────────

export const FACTS = {
  plans: {
    // = src/data/guileoPlans.js (Essential/Personalized/Full Operation)
    // 🚨 A FRASE QUE A AGENTE FALA É MONTADA DA FONTE (2026-08-21). Ela era escrita à mão aqui —
    // e no dia do reajuste a Gui cotaria $449 AO TELEFONE enquanto o site cobrava $897. O cliente
    // confere, acha a diferença, e a venda morre na primeira conferência: parece que alguém mentiu.
    // Preço tem UMA fonte e várias bocas; a boca nunca guarda a própria cópia.
    selfServe: `Self-service plans: ${GUILEO_PLANS.map((p) => `${p.name} ${p.price} (${p.credits.toLocaleString("en-US")} credits)`).join(" · ")}. 30-day money-back, cancel anytime, no setup fee.`,
    doneForYou: "Done-for-you (sold by a rep, tailored): from $990 one-time setup + $1,497/month.",
    credits: "Usage is metered in credits — roughly one task Gui does (an answered call ≈ 5 credits, a follow-up, a message). Plans renew credits monthly; one-time top-ups exist (500/$49, 1500/$119).",
  },
  languages: "Gui SPEAKS 16 languages on the phone (English, Spanish, Brazilian Portuguese, Hindi, Mandarin, Russian, Korean, French, Arabic, Vietnamese, Tagalog, German, Italian, Polish, Japanese, Ukrainian — auto-detected per caller). The dashboard UI is in 4: EN·PT·ES·HI.",
  delivery: "Live in under 7 days for done-for-you; self-serve is live in minutes (pay → connection code by email → portal). A real human supervises everything.",
  // 🚨 ESTE ARQUIVO É INJETADO NO CÉREBRO DE TODOS OS AGENTES (voz, widget, Gui Suporte, pitch-ai).
  // Cada linha aqui vira uma AFIRMAÇÃO que a agente faz ao vivo, no telefone, para um dono de
  // negócio. Ele se contradizia: as linhas de recurso citavam "missed-call text-back" e "pay-link
  // por SMS" como FATO, enquanto `channels` (abaixo) declarava SMS como PENDENTE de aprovação A2P.
  // A agente estava dizendo que manda SMS. Não manda — a campanha foi reprovada (erro 30034).
  // LEI: canal pendente aparece com o prazo colado na mesma frase. Nunca omitido (o recurso existe
  // e o código está pronto), nunca afirmado seco (vira reembolso e queima a reputação de envio).
  // Quando o A2P aprovar, tire as ressalvas AQUI, em `selfServePlans.js` e em `ARQUITETURA.md`
  // JUNTOS — os três são lidos como lei e não podem discordar. Foi a discordância que criou isto.
  coreFeatures: [
    "Answers every call & message 24/7 (unlimited simultaneous calls — no busy signal)",
    "Books appointments with double-booking protection + automatic reminders (cuts no-shows ~40%)",
    "Predictive no-show radar (risk-scores upcoming bookings; owner can act early)",
    "Busy→auto-callback (LIVE). Missed-call instant text-back: code ready, switches on the moment US SMS (A2P 10DLC) is approved — do NOT state it as available today",
    "Speed-to-lead: calls a brand-new lead back in ~60 seconds",
    "Quotes EXACT prices from the owner's real price list; closes and COLLECTS on the call (pay-link by EMAIL today — the SMS pay-link waits on A2P approval; money to the client's own Stripe)",
    "Polite receivables collection (72h-spaced reminders; owner can mark invoices paid)",
    "Win-back of quiet customers, mass reactivation blitz, 1-click flash campaigns, review machine (reaching out by CALL and EMAIL today; SMS/WhatsApp reach-out waits on approval)",
    "Packages, memberships & gift cards with Stripe checkout",
    "Emergency dispatch: a real emergency at 2am RINGS the owner's phone (with an in-portal emergency log)",
    "Hurricane/storm mode: 1 click closes the calendar, notifies everyone, reopen blast",
    "Marketplace lead responder (Yelp/Angi/Thumbtack…): lead arrives → CRM → Gui calls in 60s",
    "Webchat widget for the client's own site + unified inbox + personal CRM",
    "Weekly owner report by email (real revenue, refund-net) + morning briefing in the cockpit",
  ],
  channels: "LIVE today: voice calls, webchat widget, email flows. PENDING external approvals (honest status, code ready): US SMS (A2P 10DLC registration) and WhatsApp sender — they switch on automatically when approved.",
  guarantees: "30-day money-back. Cancel anytime, no contract on self-serve. LGPD/GDPR-aware; TCPA-aware calling with DNC list.",
  sellers: "Growth Partner program: permanent client wallet (a client you sign stays yours — recurring commission every month while they pay), commission ladder 10%→20% (Agendador→Closer), transparent refund-net statement + payouts in the seller hub (/vendedor).",
  demo: "The live demo: the visitor enters their phone on guileoai.com and Gui CALLS them, answering as if she were their business. (US carriers may show the caller as 'unknown' until CNAM registration.)",
};

// Compact string for system prompts — keep it tight (tokens) but complete.
export function factsBlock({ audience = "client" } = {}) {
  const f = FACTS;
  const base = [
    `PRODUCT FACTS (answer from THESE — never invent a feature or price):`,
    `• ${f.plans.selfServe}`,
    `• ${f.plans.doneForYou}`,
    `• ${f.plans.credits}`,
    `• ${f.languages}`,
    `• ${f.delivery}`,
    `• Features: ${f.coreFeatures.join("; ")}.`,
    `• Channels: ${f.channels}`,
    `• ${f.guarantees}`,
    `• Demo: ${f.demo}`,
  ];
  if (audience === "seller") base.push(`• Sellers: ${f.sellers}`);
  return base.join("\n");
}
