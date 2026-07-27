// Track-A self-service plans. Each `url` is a Stripe Payment Link (subscription) whose
// price carries metadata { plan, credits } so the webhook grants the right monthly credits
// and emails the client their connection code automatically. Until the live links exist,
// url stays "" and the UI shows a "talk to us" fallback (WhatsApp) so nothing dead-ends.
export const SELF_SERVE_PLANS = [
  {
    id: "starter", name: "Essential", price: 149, credits: 500,
    tagline: { en: "Get started fast", pt: "Comece rápido", es: "Empieza rápido" },
    features: {
      en: ["AI answers calls & messages 24/7", "Missed-call text-back", "Booking + reminders", "500 Gui credits / month", "Self-managed dashboard"],
      pt: ["IA atende ligações e mensagens 24/7", "Texto automático em ligação perdida", "Agendamento + lembretes", "500 créditos do Gui / mês", "Painel autogerido"],
      es: ["IA atiende llamadas y mensajes 24/7", "Texto automático en llamada perdida", "Reservas + recordatorios", "500 créditos de Gui / mes", "Panel autogestionado"],
    },
    url: "https://buy.stripe.com/bJe9AT9LldnecqjdzT3Nm0e",
    // annual Payment Link (2 months free: $1,490/yr) — to be minted; empty = no annual UI shown.
    annualUrl: "",
  },
  {
    id: "growth", name: "Personalized", price: 449, credits: 2000, popular: true,
    tagline: { en: "Most popular", pt: "Mais popular", es: "Más popular" },
    features: {
      en: ["Everything in Essential", "Speed-to-Lead (60s callback)", "Reviews machine + win-back", "2,000 Gui credits / month", "Weekly owner report"],
      pt: ["Tudo do Essential", "Speed-to-Lead (retorno em 60s)", "Máquina de reviews + win-back", "2.000 créditos do Gui / mês", "Relatório semanal do dono"],
      es: ["Todo lo de Essential", "Speed-to-Lead (devolución en 60s)", "Máquina de reseñas + reconquista", "2.000 créditos de Gui / mes", "Reporte semanal del dueño"],
    },
    url: "https://buy.stripe.com/4gM7sL9Ll0AsgGz2Vf3Nm0f",
    // annual Payment Link (2 months free: $4,490/yr) — to be minted; empty = no annual UI shown.
    annualUrl: "",
  },
  {
    id: "scale", name: "Full Operation", price: 999, credits: 6000,
    tagline: { en: "For busy operations", pt: "Pra operação movimentada", es: "Para operación con volumen" },
    features: {
      en: ["Everything in Personalized", "Multi-channel (WhatsApp, SMS, social)", "Campaigns + audiences", "6,000 Gui credits / month", "Priority support"],
      pt: ["Tudo do Personalized", "Multicanal (WhatsApp, SMS, social)", "Campanhas + públicos", "6.000 créditos do Gui / mês", "Suporte prioritário"],
      es: ["Todo lo de Personalized", "Multicanal (WhatsApp, SMS, social)", "Campañas + audiencias", "6.000 créditos de Gui / mes", "Soporte prioritario"],
    },
    url: "https://buy.stripe.com/bJe00j6z94QI2PJ0N73Nm0g",
    // annual Payment Link (2 months free: $9,990/yr) — to be minted; empty = no annual UI shown.
    annualUrl: "",
  },
];

// One-time credit top-ups (mode=payment Stripe Payment Links — NOT subscriptions).
// url stays "" until the links exist: run POST /api/setup-selfserve (mints them, metadata
// { guileo:"topup", credits }) then paste the links minted by GET /api/setup-selfserve?token=… here.
// Empty url → the Billing card shows the option grayed out ("available soon") — nothing fake ships.
export const TOPUPS = [
  { id: "topup500", credits: 500, price: 49, url: "" },
  { id: "topup1500", credits: 1500, price: 119, url: "" },
];
