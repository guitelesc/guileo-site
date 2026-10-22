// GET /api/sinal-pago?t=<negócio>&s=<sessão>  — a cliente volta do Stripe depois de pagar o sinal
// na conta PRÓPRIA do negócio. Confere a sessão lá (lib/sinalPago.js) e mostra a verdade: pago, ou
// "estamos confirmando" (o cron confere de novo de hora em hora). Nunca diz "pago" sem o Stripe dizer.
// 2026-10-05: a mesma volta serve para "Salvar cartão" e "Vender assinatura" do balcão
// (lib/stripeDoNegocio.js) — o tipo vem da etiqueta da SESSÃO, nunca da URL.
import { conferirSessaoDoDesk } from "../lib/sinalPago.js";

const T = {
  en: { ok: ["Deposit received", "Thank you — your appointment is secured. See you soon!"],
    card: ["Card saved", "Thank you — your card is saved with the business for your next visits."],
    membership: ["Membership active", "Welcome! Your membership is active — the front desk will see it on your next visit."], wait: ["Thank you", "We're confirming your payment with the bank. You'll hear from the business if anything is missing."] },
  pt: { ok: ["Sinal recebido", "Obrigado — seu horário está garantido. Até breve!"],
    card: ["Cartão salvo", "Obrigado — seu cartão ficou salvo com o estabelecimento para as próximas visitas."],
    membership: ["Assinatura ativa", "Bem-vinda! Sua assinatura está ativa — a recepção vai ver na sua próxima visita."], wait: ["Obrigado", "Estamos confirmando o pagamento com o banco. Se faltar algo, o estabelecimento avisa."] },
  es: { ok: ["Depósito recibido", "Gracias — su cita está asegurada. ¡Hasta pronto!"],
    card: ["Tarjeta guardada", "Gracias — su tarjeta quedó guardada con el negocio para sus próximas visitas."],
    membership: ["Membresía activa", "¡Bienvenida! Su membresía está activa — la recepción la verá en su próxima visita."], wait: ["Gracias", "Estamos confirmando el pago con el banco. Si falta algo, el negocio le avisará."] },
};
// "Voltar para o agendamento" (2026-10-05): só quando a sessão nasceu na página pública /agendar/<slug>
// (lib/sinal.js sinalNaTela manda &v=<slug>&l=<idioma>). Link RELATIVO e slug validado: não vira redirecionamento aberto.
const VOLTAR = { en: "Back to booking", pt: "Voltar para o agendamento", es: "Volver a la reserva" };
const pagina = (lang, [titulo, texto], volta = "") => new Response(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titulo}</title></head>
<body style="margin:0;background:#f7f4ee;font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;color:#2b2722;">
<div style="max-width:440px;margin:16vh auto 0;padding:34px 26px;background:#fff;border:1px solid #e7e1d6;border-radius:22px;text-align:center;">
<div style="font-size:30px;margin-bottom:8px;">✓</div><h1 style="font-size:23px;font-weight:700;margin:0 0 10px;">${titulo}</h1>
<p style="font-size:15px;color:#6b645a;line-height:1.7;margin:0;">${texto}</p>${volta}</div></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const al = (request.headers.get("accept-language") || "").toLowerCase();
  const ql = String(q.get("l") || "").toLowerCase();
  const l = ["en", "pt", "es"].includes(ql) ? ql : al.startsWith("pt") ? "pt" : al.startsWith("es") ? "es" : "en";
  const v = String(q.get("v") || "").toLowerCase();
  const volta = /^[a-z0-9-]{2,60}$/.test(v)
    ? `<a href="/agendar/${v}?lang=${l}" style="display:inline-block;margin-top:22px;padding:13px 22px;border-radius:14px;background:#5E7A64;color:#fff;text-decoration:none;font-weight:600;font-size:15px;">${VOLTAR[l]}</a>`
    : "";
  const tenant = String(q.get("t") || "").trim().toLowerCase().slice(0, 200);
  const r = tenant.includes("@") ? await conferirSessaoDoDesk(env, { tenant, sessionId: q.get("s") }) : { ok: false };
  const texto = !r.ok ? T[l].wait : r.kind === "card" ? T[l].card : r.kind === "membership" ? T[l].membership : T[l].ok;
  return pagina(l === "pt" ? "pt-BR" : l, texto, volta);
}
