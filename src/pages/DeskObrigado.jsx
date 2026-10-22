// /desk/obrigado — volta do pagamento do Guileo Desk no Stripe (2026-10-05).
// Não confirma nada sozinha: quem libera o plano é o webhook do Stripe (stripe-webhook ramo "desk_plan"),
// que também manda o código de acesso por e-mail. A página só diz o próximo passo, honesto.
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { DESK_PLANS, deskTxt } from "../data/deskPlans.js";

const T = {
  pt: { h: "Pagamento recebido pelo Stripe", p: "Em alguns segundos o seu plano é liberado e você recebe um e-mail com o código de conexão. Se você já tem conta, é só abrir o Balcão — o plano novo já vale.", a: "Abrir o Guileo Desk", b: "Não chegou o e-mail em 10 minutos? Responda qualquer e-mail da Guileo ou fale com a gente no WhatsApp." },
  en: { h: "Payment received by Stripe", p: "In a few seconds your plan is unlocked and you get an email with your connection code. If you already have an account, just open the Desk — the new plan applies right away.", a: "Open Guileo Desk", b: "No email after 10 minutes? Reply to any Guileo email or message us on WhatsApp." },
  es: { h: "Pago recibido por Stripe", p: "En unos segundos tu plan queda liberado y recibes un correo con tu código de conexión. Si ya tienes cuenta, abre la Recepción — el plan nuevo ya vale.", a: "Abrir Guileo Desk", b: "¿No llegó el correo en 10 minutos? Responde cualquier correo de Guileo o escríbenos por WhatsApp." },
};

export default function DeskObrigado() {
  const { lang } = useLang();
  const L = T[lang] || T.en;
  useSeo({ title: "Guileo Desk", description: L.p.slice(0, 150), path: "/desk/obrigado" });
  let plano = null;
  try { plano = DESK_PLANS.find((p) => p.key === new URLSearchParams(window.location.search).get("plano")) || null; } catch { /* sem plano na URL */ }
  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />
      <main className="mx-auto max-w-xl px-4 pt-32 pb-24 text-center">
        <img src="/desk-app-192.png" alt="" width="80" height="80" className="mx-auto h-20 w-20 rounded-2xl" />
        <h1 className="mt-5 text-3xl font-black text-g-word text-balance">{L.h}</h1>
        {plano && <div className="mt-2 text-sm font-bold text-g-gold">Guileo Desk · {deskTxt(plano.name, T[lang] ? lang : "en")}</div>}
        <p className="mt-4 text-[15px] leading-relaxed text-g-light/90">{L.p}</p>
        <a href="/portal?tab=desk" className="btn-bright mt-7 inline-block px-6 py-3 text-sm">{L.a}</a>
        <p className="mt-6 text-[12px] text-g-muted">{L.b}</p>
      </main>
      <Footer />
    </div>
  );
}
