// THE canonical Guileo plan source — one place for names, USD + BRL prices and credits.
// Same tiers as the Stripe products in functions/api/setup-selfserve.js ($149/$449/$999) — that file renames legacy "Starter/Growth/Scale" products in place to these canonical names.
// 🚨 A MOEDA É O DÓLAR, SEMPRE (decisão do Luis, 2026-08-20 — e a plataforma concorda).
// `priceBR/amountBR` espelhavam um mapa do Mercado Pago (79900/249900/549900) que NUNCA virou
// checkout: o webhook existe, mas não há UM link de pagamento em real no site inteiro. Quem lia
// "R$ 2.499" na home em português e clicava em assinar caía num Payment Link do STRIPE em DÓLAR.
// A página prometia uma moeda e a cobrança fazia outra — no momento exato da decisão de compra.
// E era pior: a home mostrava R$ e a /planos mostrava US$ para os MESMOS planos, ligadas pelo menu.
// Enquanto não existir checkout em BRL, `priceBR` carrega o preço REAL COBRADO, em dólar. Os 8
// lugares que leem esse campo passam a dizer a verdade sem precisar de mudança nenhuma.
// ⚠️ Para reativar o real de verdade: construir o checkout em BRL (Mercado Pago/PIX) PRIMEIRO,
// e só então trazer o valor em R$ de volta AQUI. Preço sem caminho de pagamento é intenção,
// não preço.
// Consumed by: OnboardWizard (plan dropdown + credits sync), SellerQuote (plan chips),
// and anywhere else a plan must be named — never hardcode plan prices elsewhere.
// 🚨 CANAL PENDENTE VAI ROTULADO NA PRÓPRIA LINHA (2026-08-20).
// O Personalized vendia "Voz + chat + WhatsApp + redes" e o Full Operation vendia "Todos os
// canais" — e dos canais citados, SMS (A2P 10DLC reprovado, erro 30034), WhatsApp e IG/Messenger
// (`meta-app-not-approved`) NÃO entregam saída hoje. "Todos os canais" era literalmente falso.
// O recurso não sai da tabela: o código está pronto e liga sozinho na aprovação. O que muda é
// dizer DE QUEM depende — nunca "em breve", nunca data inventada.
// ⚠️ Quando aprovar, tire a ressalva em `productFacts.js`, `selfServePlans.js`, `ARQUITETURA.md`
// e AQUI, no mesmo commit. Os quatro são lidos como lei e não podem discordar.
// ═══ REPREÇO 2026-08-21 ═════════════════════════════════════════════════════════════════════
// Personalized $449 → $897 · Full Operation $999 → $1.997. A entrada ($149) NÃO muda: é a cunha.
//
// POR QUÊ: o mercado cobra por AUTOMAÇÃO, não por pacote. As dez automações que os concorrentes
// vendem separadas somam US$ 14.750/mês; o Full Operation entregava 18 produtos por US$ 999 — um
// desconto de 93%. Desconto desse tamanho não lê como oportunidade, lê como defeito escondido:
// o dono não conclui "barato", conclui "o que falta aí?".
//
// E o preço baixo não machucava o cliente — machucava o CANAL. Com 50% de comissão, o vendedor
// ganhava US$ 224/mês por cliente fechado. A US$ 897 ganha US$ 448, pelo mesmo esforço de venda.
// Vendedor trabalha onde o dinheiro está; preço baixo demais deixa a empresa sem quem venda.
//
// 🚨 OS CRÉDITOS SOBEM JUNTO (2.000→3.000 e 6.000→9.000). Subir preço sem subir entrega é o que
// transforma reajuste em motivo de cancelamento. Mesmo assim continuamos ~7× abaixo do mercado.
//
// 🚨 CLIENTE ATUAL FICA NA CONDIÇÃO ANTIGA. O preço vive aqui e vale para quem ENTRA; quem já
// paga tem o valor gravado em `client_credits`. Mexer no que já foi vendido é a única coisa pior
// que cobrar pouco.
// ═══ amountBRL — O PREÇO EM REAL DE VERDADE (2026-08-25) ════════════════════════════════════
// ⚠️ preço BRL = decisão do dono, ainda não definida (2026-08-25). null = o pay-link BR responde
// nao_configurado. Definir aqui E no BRL_CREDITS do mercadopago-webhook no MESMO commit.
// (`priceBR`/`amountBR` acima continuam sendo o preço REAL COBRADO hoje — em DÓLAR. `amountBRL`
// é outra coisa: o valor em R$ que o checkout do Mercado Pago cobraria. Nunca converta por conta
// própria — câmbio não é decisão de código, é decisão de preço.)
export const GUILEO_PLANS = [
  {
    key: "starter", name: "Essential", price: "$149/mo", amount: 149, priceBR: "US$ 149/mês", amountBR: 149, amountBRL: null, credits: 500,
    tag: { pt: "Comece simples", en: "Start simple", es: "Empieza simple", hi: "सरल शुरुआत" },
    feats: {
      pt: ["Recepcionista IA de voz 24/7 (1 agente)", "Agendamentos + lembretes", "500 créditos/mês", "Garantia de 30 dias"],
      en: ["24/7 AI voice receptionist (1 agent)", "Bookings + reminders", "500 credits/mo", "30-day money-back"],
      es: ["Recepcionista IA de voz 24/7 (1 agente)", "Reservas + recordatorios", "500 créditos/mes", "Garantía de 30 días"],
      hi: ["24/7 AI वॉइस रिसेप्शनिस्ट (1 एजेंट)", "बुकिंग + रिमाइंडर", "500 क्रेडिट/माह", "30-दिन मनी-बैक"],
    },
  },
  {
    key: "growth", name: "Personalized", price: "$897/mo", amount: 897, priceBR: "US$ 897/mês", amountBR: 897, amountBRL: null, credits: 3000, featured: true,
    tag: { pt: "Mais popular", en: "Most popular", es: "Más popular", hi: "सबसे लोकप्रिय" },
    feats: {
      pt: ["Voz + chat já no ar; WhatsApp e redes ligam quando Meta/operadora aprovarem", "Vendas & marketing automáticos", "3.000 créditos/mês", "Suporte prioritário"],
      en: ["Voice + chat live today; WhatsApp and social switch on when Meta/carrier approve", "Automated sales & marketing", "3,000 credits/mo", "Priority support"],
      es: ["Voz + chat ya activos; WhatsApp y redes se activan al aprobar Meta/operadora", "Ventas & marketing automáticos", "3.000 créditos/mes", "Soporte prioritario"],
      hi: ["वॉइस + चैट अभी लाइव; WhatsApp और सोशल Meta/ऑपरेटर की मंज़ूरी पर चालू", "ऑटो सेल्स & मार्केटिंग", "3,000 क्रेडिट/माह", "प्राथमिकता सपोर्ट"],
    },
  },
  {
    key: "scale", name: "Full Operation", price: "$1,997/mo", amount: 1997, priceBR: "US$ 1.997/mês", amountBR: 1997, amountBRL: null, credits: 9000,
    tag: { pt: "Operação completa", en: "We run it all", es: "Operación completa", hi: "पूरा संचालन" },
    feats: {
      pt: ["Todos os canais que já estão no ar + campanhas (WhatsApp/SMS entram na aprovação)", "9.000 créditos/mês", "Implantação profunda", "Time dedicado"],
      en: ["Every channel that's live + campaigns (WhatsApp/SMS join at approval)", "9,000 credits/mo", "Deep implementation", "Dedicated team"],
      es: ["Todos los canales ya activos + campañas (WhatsApp/SMS entran al aprobarse)", "9.000 créditos/mes", "Implementación profunda", "Equipo dedicado"],
      hi: ["हर लाइव चैनल + कैंपेन (WhatsApp/SMS मंज़ूरी पर जुड़ेंगे)", "9,000 क्रेडिट/माह", "गहरा इम्प्लीमेंटेशन", "समर्पित टीम"],
    },
  },
];
export const planByKey = (k) => GUILEO_PLANS.find((p) => p.key === k) || GUILEO_PLANS[1];
// Payment page a seller hands the client (ref = permanent attribution).
export const payLink = (clientEmail, ref) =>
  `https://guileoai.com/planos?email=${encodeURIComponent(clientEmail || "")}&ref=${encodeURIComponent(ref || "")}`;

// ── Mapa BRL derivado (fonte única do preço em real) ────────────────────────────────────────
// Plano com `amountBRL: null` simplesmente NÃO existe neste mapa. Mapa vazio = nenhum crédito BR
// até o dono definir preço — é isso que faz o pay-link BR responder `nao_configurado` e o
// mercadopago-webhook recusar creditar por valor desconhecido em vez de creditar errado.
// Chave = CENTAVOS de real (o webhook compara com transaction_amount × 100).
export const brlCents = (p) => (p && Number.isFinite(Number(p.amountBRL)) && Number(p.amountBRL) > 0 ? Math.round(Number(p.amountBRL) * 100) : null);
export const BRL_CREDITS_MAP = Object.fromEntries(
  GUILEO_PLANS.map((p) => [brlCents(p), p.credits]).filter(([c]) => c !== null && c !== "null")
);
export const BRL_PLAN_MAP = Object.fromEntries(
  GUILEO_PLANS.map((p) => [brlCents(p), p.name]).filter(([c]) => c !== null && c !== "null")
);
