// Track-A self-service plans. Each `url` is a Stripe Payment Link (subscription) whose
// price carries metadata { plan, credits } so the webhook grants the right monthly credits
// and emails the client their connection code automatically. Until the live links exist,
// url stays "" and the UI shows a "talk to us" fallback (WhatsApp) so nothing dead-ends.
// 🚨 CANAL QUE AINDA NÃO ENTREGA VAI ROTULADO — NUNCA OMITIDO, NUNCA PROMETIDO SECO (2026-08-20).
// A auditoria cruzou estes planos com `functions/lib/productFacts.js`, que declara o estado REAL
// dos canais: **SMS (A2P 10DLC) e WhatsApp estão PENDENTES de aprovação externa**, com o código
// pronto e ligando sozinho quando aprovarem. E estes planos vendiam "Missed-call text-back — the moment the carrier approves A2P (code is ready)" no
// Essential e "Multicanal: webchat + e-mail ya activos; WhatsApp y SMS se activan al aprobarse" no Full Operation — dois recursos que o cliente
// paga hoje e NÃO recebe. Toda venda feita nessa promessa é um reembolso marcado, e é justo a
// manchete do produto.
// A correção NÃO é apagar: o recurso existe e é real. É dizer a verdade do prazo — o mesmo padrão
// de "condição" que o Processo já usa ("depende de: aprovação da Meta"). Recurso rotulado ainda
// vende; recurso prometido e não entregue destrói a conta e a reputação de envio.
// ⚠️ Quando o A2P e o WhatsApp forem aprovados, tire o sufixo AQUI e em `productFacts.js` juntos —
// os dois arquivos são lidos como lei e não podem discordar.
export const SELF_SERVE_PLANS = [
  {
    id: "starter", name: "Essential", price: 149, credits: 500,
    tagline: { en: "Get started fast", pt: "Comece rápido", es: "Empieza rápido" },
    features: {
      en: ["AI answers calls & messages 24/7", "Missed-call text-back — the moment the carrier approves A2P (code is ready)", "Booking + reminders", "500 Gui credits / month", "Self-managed dashboard"],
      pt: ["IA atende ligações e mensagens 24/7", "Texto automático em ligação perdida — assim que a operadora aprovar o A2P (código pronto)", "Agendamento + lembretes", "500 créditos do Gui / mês", "Painel autogerido"],
      es: ["IA atiende llamadas y mensajes 24/7", "Texto automático en llamada perdida — en cuanto la operadora apruebe el A2P (código listo)", "Reservas + recordatorios", "500 créditos de Gui / mes", "Panel autogestionado"],
    },
    url: "https://buy.stripe.com/bJe9AT9LldnecqjdzT3Nm0e",
    // annual Payment Link (2 months free: $1,490/yr) — to be minted; empty = no annual UI shown.
    annualUrl: "",
  },
  {
    id: "growth", name: "Personalized", price: 449, credits: 2000, popular: true,
    tagline: { en: "Most popular", pt: "Mais popular", es: "Más popular" },
    features: {
      en: ["Everything in Essential", "Speed-to-Lead (60s callback)", "Reviews machine + win-back", "3,000 Gui credits / month", "Weekly owner report"],
      pt: ["Tudo do Essential", "Speed-to-Lead (retorno em 60s)", "Máquina de reviews + win-back", "3.000 créditos do Gui / mês", "Relatório semanal do dono"],
      es: ["Todo lo de Essential", "Speed-to-Lead (devolución en 60s)", "Máquina de reseñas + reconquista", "3.000 créditos de Gui / mes", "Reporte semanal del dueño"],
    },
    url: "https://buy.stripe.com/eVq9ATaPp4QIcqjdzT3Nm0l",
    // annual Payment Link (2 months free: $4,490/yr) — to be minted; empty = no annual UI shown.
    annualUrl: "",
  },
  {
    id: "scale", name: "Full Operation", price: 1997, credits: 9000,
    tagline: { en: "For busy operations", pt: "Pra operação movimentada", es: "Para operación con volumen" },
    features: {
      en: ["Everything in Personalized", "Multi-channel: webchat + email live today; WhatsApp and SMS switch on when approved", "Campaigns + audiences", "9,000 Gui credits / month", "Priority support"],
      pt: ["Tudo do Personalized", "Multicanal: webchat + e-mail já no ar; WhatsApp e SMS ligam quando aprovarem", "Campanhas + públicos", "9.000 créditos do Gui / mês", "Suporte prioritário"],
      es: ["Todo lo de Personalized", "Multicanal: webchat + e-mail ya activos; WhatsApp y SMS se activan al aprobarse", "Campañas + audiencias", "9.000 créditos de Gui / mes", "Soporte prioritario"],
    },
    url: "https://buy.stripe.com/4gM8wP6z9gzqcqj2Vf3Nm0m",
    // annual Payment Link (2 months free: $9,990/yr) — to be minted; empty = no annual UI shown.
    annualUrl: "",
  },
];

// One-time credit top-ups (mode=payment Stripe Payment Links — NOT subscriptions).
// url stays "" until the links exist: run POST /api/setup-selfserve (mints them, metadata
// { guileo:"topup", credits }) then paste the links minted by GET /api/setup-selfserve?token=… here.
// Empty url → the Billing card shows the option grayed out ("available soon") — nothing fake ships.
export const TOPUPS = [
  { id: "topup500", credits: 500, price: 49, url: "https://buy.stripe.com/fZu6oH2iT4QIcqjgM53Nm0h" },
  { id: "topup1500", credits: 1500, price: 119, url: "https://buy.stripe.com/4gMdR9cXx4QIfCv67r3Nm0i" },
];
