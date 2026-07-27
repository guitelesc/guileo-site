// THE canonical Guileo plan source — one place for names, USD + BRL prices and credits.
// Same tiers as the Stripe products in functions/api/setup-selfserve.js ($149/$449/$999) — that file renames legacy "Starter/Growth/Scale" products in place to these canonical names.
// priceBR/amountBR mirror the Mercado Pago BRL map (79900→500cr · 249900→2000cr · 549900→6000cr).
// Consumed by: OnboardWizard (plan dropdown + credits sync), SellerQuote (plan chips),
// and anywhere else a plan must be named — never hardcode plan prices elsewhere.
export const GUILEO_PLANS = [
  {
    key: "starter", name: "Essential", price: "$149/mo", amount: 149, priceBR: "R$ 799/mês", amountBR: 799, credits: 500,
    tag: { pt: "Comece simples", en: "Start simple", es: "Empieza simple", hi: "सरल शुरुआत" },
    feats: {
      pt: ["Recepcionista IA de voz 24/7 (1 agente)", "Agendamentos + lembretes", "500 créditos/mês", "Garantia de 30 dias"],
      en: ["24/7 AI voice receptionist (1 agent)", "Bookings + reminders", "500 credits/mo", "30-day money-back"],
      es: ["Recepcionista IA de voz 24/7 (1 agente)", "Reservas + recordatorios", "500 créditos/mes", "Garantía de 30 días"],
      hi: ["24/7 AI वॉइस रिसेप्शनिस्ट (1 एजेंट)", "बुकिंग + रिमाइंडर", "500 क्रेडिट/माह", "30-दिन मनी-बैक"],
    },
  },
  {
    key: "growth", name: "Personalized", price: "$449/mo", amount: 449, priceBR: "R$ 2.499/mês", amountBR: 2499, credits: 2000, featured: true,
    tag: { pt: "Mais popular", en: "Most popular", es: "Más popular", hi: "सबसे लोकप्रिय" },
    feats: {
      pt: ["Voz + chat + WhatsApp + redes", "Vendas & marketing automáticos", "2.000 créditos/mês", "Suporte prioritário"],
      en: ["Voice + chat + WhatsApp + social", "Automated sales & marketing", "2,000 credits/mo", "Priority support"],
      es: ["Voz + chat + WhatsApp + redes", "Ventas & marketing automáticos", "2.000 créditos/mes", "Soporte prioritario"],
      hi: ["वॉइस + चैट + WhatsApp + सोशल", "ऑटो सेल्स & मार्केटिंग", "2,000 क्रेडिट/माह", "प्राथमिकता सपोर्ट"],
    },
  },
  {
    key: "scale", name: "Full Operation", price: "$999/mo", amount: 999, priceBR: "R$ 5.499/mês", amountBR: 5499, credits: 6000,
    tag: { pt: "Operação completa", en: "We run it all", es: "Operación completa", hi: "पूरा संचालन" },
    feats: {
      pt: ["Todos os canais + campanhas", "6.000 créditos/mês", "Implantação profunda", "Time dedicado"],
      en: ["Every channel + campaigns", "6,000 credits/mo", "Deep implementation", "Dedicated team"],
      es: ["Todos los canales + campañas", "6.000 créditos/mes", "Implementación profunda", "Equipo dedicado"],
      hi: ["हर चैनल + कैंपेन", "6,000 क्रेडिट/माह", "गहरा इम्प्लीमेंटेशन", "समर्पित टीम"],
    },
  },
];
export const planByKey = (k) => GUILEO_PLANS.find((p) => p.key === k) || GUILEO_PLANS[1];
// Payment page a seller hands the client (ref = permanent attribution).
export const payLink = (clientEmail, ref) =>
  `https://guileoai.com/planos?email=${encodeURIComponent(clientEmail || "")}&ref=${encodeURIComponent(ref || "")}`;
