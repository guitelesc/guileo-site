import LegalDoc from "../components/LegalDoc.jsx";
import { useSeo } from "../lib/seo.js";
import { useLang } from "../i18n.jsx";

// Refund & Cancellation Policy — TEMPLATE. Backs the "30-day money-back" claim shown across the
// landing and gives paid customers (Stripe plans, top-ups, setup fees) clear terms. Lawyer review
// required before relying on it commercially. Grounded in how Guileo actually bills: monthly credit
// plans, one-time credit top-ups, and an optional assisted-setup fee — no long-term contract.

const EN_SECTIONS = [
  { h: "30-day money-back guarantee", body: <p>New customers on a monthly plan may request a <strong>full refund within 30 days</strong> of their first payment if Guileo isn't the right fit — no questions asked. Email <a href="mailto:smart@guileoai.com">smart@guileoai.com</a> from your account email and we'll process it.</p> },
  { h: "Cancelling your plan", body: <p>There is <strong>no long-term contract</strong>. You can cancel any time; your plan stays active until the end of the current billing period and does not renew afterward. Cancelling stops future charges — it is not itself a refund of the current period (except under the 30-day guarantee above).</p> },
  { h: "Credits", body: <ul className="space-y-1"><li><strong>Unused credits</strong> from a monthly plan expire at the end of the billing period and are not cash-refundable.</li><li><strong>One-time credit top-ups</strong> are non-refundable once purchased, except where required by law, because they're available immediately.</li><li>Credits already <strong>consumed</strong> (calls answered, messages sent, tasks run) are never refundable — the work was delivered.</li></ul> },
  { h: "Assisted-setup fee", body: <p>The optional <strong>Assisted Setup</strong> is a one-time service fee. It is refundable only if we have not yet started the setup work; once your agent has been configured and gone live, it is non-refundable.</p> },
  { h: "How refunds are issued", body: <p>Approved refunds go back to your <strong>original payment method</strong> via Stripe, typically within <strong>5–10 business days</strong> depending on your bank. We refund in the currency you were charged.</p> },
  { h: "Chargebacks & disputes", body: <p>If you believe a charge is wrong, please contact us first — we resolve almost everything within a day. Opening a bank chargeback before contacting us may pause your account while the dispute is investigated.</p> },
  { h: "Payments made by your customers", body: <p>When Gui collects a payment <strong>from your customer on your behalf</strong> (e.g. a booking deposit), that money belongs to <strong>you</strong>, and any refund to that customer is handled by <strong>you</strong> from your own account — Guileo only provides the payment rail.</p> },
  { h: "Contact", body: <p>Refund or cancellation requests: <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>. Include your account email so we can find your subscription quickly.</p> },
];

const PT_SECTIONS = [
  { h: "Garantia de 30 dias (dinheiro de volta)", body: <p>Clientes novos em um plano mensal podem pedir <strong>reembolso total em até 30 dias</strong> do primeiro pagamento, se a Guileo não fizer sentido — sem perguntas. Escreva para <a href="mailto:smart@guileoai.com">smart@guileoai.com</a> pelo e-mail da sua conta e a gente resolve.</p> },
  { h: "Cancelar o plano", body: <p><strong>Não existe contrato de fidelidade.</strong> Você cancela quando quiser; o plano continua ativo até o fim do período já pago e não renova depois. Cancelar interrompe as próximas cobranças — não é, por si só, um reembolso do período atual (exceto pela garantia de 30 dias acima).</p> },
  { h: "Créditos", body: <ul className="space-y-1"><li><strong>Créditos não usados</strong> do plano mensal expiram no fim do período e não viram dinheiro de volta.</li><li><strong>Recargas avulsas</strong> de crédito não são reembolsáveis após a compra, salvo exigência legal, porque ficam disponíveis na hora.</li><li>Créditos já <strong>consumidos</strong> (ligações atendidas, mensagens enviadas, tarefas feitas) nunca são reembolsáveis — o trabalho foi entregue.</li></ul> },
  { h: "Taxa de Configuração Assistida", body: <p>A <strong>Configuração Assistida</strong> (opcional) é uma taxa única de serviço. Só é reembolsável se ainda não tivermos começado o trabalho; depois que seu agente é configurado e vai ao ar, não é reembolsável.</p> },
  { h: "Como o reembolso é feito", body: <p>Reembolsos aprovados voltam para o <strong>meio de pagamento original</strong> via Stripe, normalmente em <strong>5–10 dias úteis</strong> conforme o seu banco. Devolvemos na moeda em que você foi cobrado.</p> },
  { h: "Chargebacks e disputas", body: <p>Se achar que uma cobrança está errada, fale com a gente primeiro — resolvemos quase tudo em um dia. Abrir um chargeback no banco antes de nos contatar pode pausar sua conta enquanto a disputa é investigada.</p> },
  { h: "Pagamentos feitos pelos seus clientes", body: <p>Quando a Gui coleta um pagamento <strong>do seu cliente em seu nome</strong> (ex.: sinal de reserva), esse dinheiro é <strong>seu</strong>, e qualquer reembolso a esse cliente é feito por <strong>você</strong>, da sua própria conta — a Guileo só fornece o trilho de pagamento.</p> },
  { h: "Contato", body: <p>Pedidos de reembolso ou cancelamento: <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>. Inclua o e-mail da sua conta pra acharmos sua assinatura rápido.</p> },
];

const ES_HEADINGS = ["Garantía de 30 días (devolución de dinero)", "Cancelar tu plan", "Créditos", "Tarifa de configuración asistida", "Cómo se emiten los reembolsos", "Contracargos y disputas", "Pagos hechos por tus clientes", "Contacto"];
const HI_HEADINGS = ["30-दिन मनी-बैक गारंटी", "अपना प्लान रद्द करना", "क्रेडिट", "असिस्टेड-सेटअप शुल्क", "रिफ़ंड कैसे जारी होते हैं", "चार्जबैक व विवाद", "आपके ग्राहकों द्वारा किए गए भुगतान", "संपर्क"];

const D = {
  en: { title: "Refund & Cancellation Policy", updated: "July 21, 2026",
    note: <>ℹ️ How refunds, cancellations and our <span className="font-bold text-g-word">30-day money-back guarantee</span> work. For clients, your signed agreement supplements this policy.</>,
    intro: <>Guileo (operated by ORIGEM LTDA) wants you to feel safe trying us. This page explains how to cancel, when you can get money back, and how refunds are processed.</>,
    sections: EN_SECTIONS },
  pt: { title: "Política de Reembolso e Cancelamento", updated: "21 de julho de 2026",
    note: <>ℹ️ Como funcionam reembolsos, cancelamentos e nossa <span className="font-bold text-g-word">garantia de 30 dias</span>. Para clientes, o contrato assinado complementa esta política.</>,
    intro: <>A Guileo (operada pela ORIGEM LTDA) quer que você se sinta seguro pra testar. Esta página explica como cancelar, quando dá pra ter o dinheiro de volta e como o reembolso é feito.</>,
    sections: PT_SECTIONS },
  es: { title: "Política de Reembolso y Cancelación", updated: "21 de julio de 2026",
    note: <>ℹ️ Cómo funcionan los reembolsos, cancelaciones y nuestra <span className="font-bold text-g-word">garantía de 30 días</span>. <span className="block mt-1 font-bold">Versión legal oficial en inglés — el texto de las secciones se muestra en inglés.</span></>,
    intro: <>Guileo (operada por ORIGEM LTDA) quiere que te sientas seguro al probarnos. Esta página explica cómo cancelar, cuándo puedes recuperar tu dinero y cómo se procesan los reembolsos.</>,
    sections: EN_SECTIONS.map((s, i) => ({ h: ES_HEADINGS[i] || s.h, body: s.body })) },
  hi: { title: "रिफ़ंड और रद्दीकरण नीति", updated: "21 जुलाई 2026",
    note: <>ℹ️ रिफ़ंड, रद्दीकरण और हमारी <span className="font-bold text-g-word">30-दिन मनी-बैक गारंटी</span> कैसे काम करती है। <span className="block mt-1 font-bold">आधिकारिक कानूनी संस्करण अंग्रेज़ी में है।</span></>,
    intro: <>Guileo (ORIGEM LTDA द्वारा संचालित) चाहता है कि आप हमें आज़माते समय सुरक्षित महसूस करें। यह पृष्ठ बताता है कि कैसे रद्द करें, कब पैसा वापस मिल सकता है, और रिफ़ंड कैसे प्रोसेस होते हैं।</>,
    sections: EN_SECTIONS.map((s, i) => ({ h: HI_HEADINGS[i] || s.h, body: s.body })) },
};

export default function Refunds() {
  const { lang } = useLang();
  const c = D[lang] || D.en;
  useSeo({ title: "Refund & Cancellation Policy | Guileo", description: "Guileo's refund, cancellation and 30-day money-back terms for plans, credit top-ups and setup fees.", path: "/refunds" });
  return <LegalDoc title={c.title} updated={c.updated} note={c.note} intro={c.intro} sections={c.sections} />;
}
