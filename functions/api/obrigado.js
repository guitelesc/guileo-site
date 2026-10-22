// /api/obrigado — a página para onde o Stripe devolve a CLIENTE DO NEGÓCIO depois de pagar (2026-09-30).
// Antes o checkout de gift card/pacote devolvia a compradora para /portal — o painel do DONO, com tela
// de login. Esta página só diz a verdade do momento: o pagamento foi recebido (ou cancelado) e o
// negócio dá sequência. Não lê nada, não grava nada, não promete prazo nem código.
const T = {
  en: { gift: ["Payment received", "Thank you. Your gift card is issued now, and the business will send you the details."], cancel: ["Payment not completed", "Nothing was charged. You can use the link again whenever you like."], ok: ["Payment received", "Thank you — the business has been notified."] },
  pt: { gift: ["Pagamento recebido", "Obrigado. O seu vale-presente é emitido agora, e o estabelecimento envia os detalhes para você."], cancel: ["Pagamento não concluído", "Nada foi cobrado. Você pode usar o link de novo quando quiser."], ok: ["Pagamento recebido", "Obrigado — o estabelecimento já foi avisado."] },
  es: { gift: ["Pago recibido", "Gracias. Su tarjeta de regalo se emite ahora, y el negocio le envía los detalles."], cancel: ["Pago no completado", "No se cobró nada. Puede usar el enlace de nuevo cuando quiera."], ok: ["Pago recibido", "Gracias — el negocio ya fue avisado."] },
};
export function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  const l = (q.get("l") || "en").toLowerCase().slice(0, 2);
  const t = T[l === "pt" || l === "es" ? l : "en"];
  const o = q.get("o");
  const [titulo, texto] = o === "gift" ? t.gift : o === "cancel" ? t.cancel : t.ok;
  return new Response(`<!doctype html><html lang="${l === "pt" ? "pt-BR" : l === "es" ? "es" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titulo}</title></head>
<body style="margin:0;background:#0e0d0b;font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;color:#ede7dc;">
<div style="max-width:440px;margin:16vh auto 0;padding:34px 26px;background:#161512;border:1px solid #2b2720;border-radius:22px;text-align:center;">
<h1 style="font-size:23px;font-weight:800;color:#f4f1ea;margin:0 0 10px;">${titulo}</h1>
<p style="font-size:15px;color:#c5beb0;line-height:1.7;margin:0;">${texto}</p>
</div></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
