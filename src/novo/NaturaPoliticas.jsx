/* NATURA — POLÍTICAS (vista #policies; âncoras #privacy, #cancellation, #store-policies).
   Por que existe (2026-10-04): o site antigo tem /privacy-policy e /cancellation-policy; no dia em que o
   domínio vier para cá, esses endereços precisam de um lugar (dominio.js · ANTIGOS manda para cá). E
   loja online precisa de regras de envio, retirada e devolução escritas.

   O QUE É DELES E O QUE É RASCUNHO
   • Privacidade e cancelamento: texto DELES, igual ao de naturaspanyc.com (lido em 2026-10-04).
   • Duas adições à privacidade (pagamento da loja pelo Stripe; assistente de voz) e as regras da loja:
     RASCUNHO nosso, marcado na tela até a Lilian aprovar. Prazo de 14 dias de retirada, 2 dias úteis para
     despachar e 30 dias de devolução são PROPOSTAS — ela decide. Frete e endereços vêm do catálogo da loja. */
import { LOJA, ENTREGAS, usd } from "./naturaStoreCatalogo.js";

export const POLITICAS_APROVADAS = false;   // vira true quando a Lilian aprovar os rascunhos

const PRIVACIDADE = [
  ["", ["At Natura Spa and Salon, your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your personal information when you interact with our website, book services, or visit our spa, med spa, or hair salon locations in Astoria and the Upper East Side of Manhattan."]],
  ["Information We Collect", ["Contact Information: Name, email address, phone number, mailing address", "Appointment Information: Date, time, location, and services requested", "Payment Information: Collected and processed securely through our booking partner", "Health & Wellness Notes: Voluntarily provided for personalized service", "Communication Preferences: Newsletter sign-ups, promotional opt-ins", "Usage Data: Pages visited, browser type, IP address, and device info (via Google Analytics)"], true],
  ["How We Collect Information", ["Your information may be collected when you:"], false, ["Book an appointment online via the MindBody platform", "Fill out a contact or consultation form on our website", "Subscribe to our email list", "Communicate with our team via email, phone, or in person", "Browse our website (usage data is collected automatically)"]],
  ["How We Use Your Information", ["We use your personal information to:"], false, ["Schedule and manage appointments", "Personalize your services based on your needs", "Send appointment confirmations, reminders, and updates", "Improve our website and services with analytics", "Share promotions and updates (only with your consent)"]],
  ["Third-Party Services", ["We work with trusted third-party platforms:"], false, ["MindBody: Booking and appointment management", "Google Analytics: Website performance and usage tracking", "Email Marketing Services: Newsletters and promotions (opt-in only)"], ["Each of these services has its own privacy policy that we encourage you to review."]],
  ["Data Protection", ["We implement appropriate measures to secure your personal information against unauthorized access, disclosure, or destruction. While no system is completely secure, we follow industry standards to protect your data."]],
  ["Your Rights", ["You have the right to:"], false, ["Access or update your personal information", "Request deletion of your data", "Unsubscribe from marketing communications", "Inquire about how your data is used"], ["To make a request, please email us at naturaspanyc@gmail.com."]],
  ["Cookies & Tracking", ["We use cookies to improve your browsing experience and collect traffic data through Google Analytics. You can adjust cookie settings in your browser at any time."]],
  ["Changes to This Policy", ["We may update this policy periodically. Changes will be reflected on this page with a revised effective date. Continued use of our website and services constitutes your acceptance of the updated policy."]],
  ["Contact Us", ["If you have any questions about this Privacy Policy, please contact us at: Natura Spa and Salon, 30-79 Steinway Street, Astoria, NY 11103 · Phone: 718.956.5530 · Email: naturaspanyc@gmail.com"]],
];

/* RASCUNHO — o que o site novo faz e a política de hoje não diz. */
const PRIVACIDADE_NOVO = [
  ["Online Store Payments", "When you buy from our online store, your payment is processed by Stripe. We receive your name, email, phone number, your shipping address if you choose shipping, and what you ordered. We never see or store your full card number."],
  ["Our AI Assistant", "Our website and phone line include an AI assistant that answers questions and helps you book. When you talk or write to it, the conversation may be recorded and transcribed so our team can follow up and improve the service. Please don’t share health or payment details with the assistant."],
];

const CANCELAMENTO = [
  "When you book an appointment at Natura Spa, we reserve the time and space especially for you. We respectfully request you to notify us at least 24 hours in advance if you wish to cancel or reschedule your appointment.",
  "Late cancellations cost us precious time and money, therefore cancellation or rescheduling of an appointment less than 24 hours’ notice will result in a fee of 50% of the booked services. No shows and same day cancellations will result in 100% of the booked services.",
  "We appreciate your understanding of our updated business scheduling policies. We thank you for your respect, loyalty, and support of our dedicated salon team and we look forward to seeing you.",
];

function regrasDaLoja() {
  const retiradas = ENTREGAS.filter((e) => e.cents === 0).map((e) => `${e.nome.replace(/^Pick up (in|on) (the )?/i, "")} (${e.sub})`).join(" or ");
  return [
    ["Pickup", `Choose ${retiradas} at checkout. Pickup is always free. Your order waits at the front desk under the name on the order, and we hold it for 14 days.`],
    ["Shipping", `We ship within the United States. Shipping is ${usd(LOJA.freteCents)}, and free on orders of ${usd(LOJA.freteGratisCents)} or more. Orders usually leave the salon within 2 business days.`],
    ["Returns", "Unopened products in their original packaging can be returned within 30 days for a refund to the original payment method. For hygiene reasons, opened products can’t be returned unless they arrived damaged — in that case, contact us and we’ll make it right."],
    ["Questions about an order", "Call Astoria at 718-956-5530 or the Upper East Side at 212-258-0661, or email naturaspanyc@gmail.com."],
  ];
}

const Rascunho = () => (POLITICAS_APROVADAS ? null : <p className="np-rasc">Draft — pending Natura Spa’s approval</p>);

export default function NaturaPoliticas({ hidden }) {
  return (
    <section className="nt-sec np" id="policies" hidden={hidden}>
      <style>{`
        .np .nt-in{max-width:820px}
        .np h3{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:300;font-size:clamp(30px,3.4vw,40px);line-height:1.15;margin:0 0 6px;scroll-margin-top:120px}
        .np h4{font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--tinta);margin:26px 0 8px}
        .np p,.np li{font-size:15.5px;line-height:1.75;color:var(--texto)}
        .np ul{margin:6px 0 0;padding-left:20px}
        .np .np-data{font-size:13px;color:var(--texto);margin-bottom:10px}
        .np article{padding:44px 0;border-top:1px solid var(--fio)}
        .np article:first-of-type{border-top:0;padding-top:20px}
        .np .np-novo{margin-top:30px;padding:22px 24px;border-radius:24px 8px 24px 8px;background:var(--creme)}
        .np .np-rasc{display:inline-block;margin:0 0 12px;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--rosa-p);box-shadow:inset 0 0 0 1px var(--rosa);background:#fff}
      `}</style>
      <div className="nt-in">
        <h2 className="nt-h2">Policies</h2>

        <article id="privacy">
          <h3>Privacy Policy</h3>
          <p className="np-data">Effective Date: June 18, 2025 · Last Updated: June 18, 2025</p>
          {PRIVACIDADE.map(([titulo, paragrafos, comoLista, lista, depois]) => (
            <div key={titulo || "intro"}>
              {titulo && <h4>{titulo}</h4>}
              {comoLista ? <ul>{paragrafos.map((t) => <li key={t}>{t}</li>)}</ul> : paragrafos.map((t) => <p key={t}>{t}</p>)}
              {lista && <ul>{lista.map((t) => <li key={t}>{t}</li>)}</ul>}
              {depois && depois.map((t) => <p key={t}>{t}</p>)}
            </div>
          ))}
          <div className="np-novo">
            <Rascunho />
            {PRIVACIDADE_NOVO.map(([titulo, texto]) => (<div key={titulo}><h4>{titulo}</h4><p>{texto}</p></div>))}
          </div>
        </article>

        <article id="cancellation">
          <h3>Cancellation Policy</h3>
          {CANCELAMENTO.map((t) => <p key={t}>{t}</p>)}
        </article>

        <article id="store-policies">
          <h3>Shipping, Pickup &amp; Returns</h3>
          <Rascunho />
          {regrasDaLoja().map(([titulo, texto]) => (<div key={titulo}><h4>{titulo}</h4><p>{texto}</p></div>))}
        </article>
      </div>
    </section>
  );
}
