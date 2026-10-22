// GET /api/venda-paga?t=<negócio>&s=<sessão>  — a cliente volta do Stripe depois de comprar um PACOTE
// ou VALE-PRESENTE na conta PRÓPRIA do negócio (lib/vendaOnlineNegocio.js). Confere a sessão lá e, se
// paga, entrega (pacote / vale nasce uma vez só — a conferência de hora em hora pode ver a mesma sessão).
// Nunca diz "recebido" sem o Stripe dizer: sem confirmação mostra "estamos confirmando".
// O tipo vem da etiqueta da SESSÃO, nunca da URL. O código do vale NÃO aparece aqui (igual ao caminho da
// plataforma, /api/obrigado?o=gift): ele vai por e-mail (lib/vendaOnlineNegocio.js · enviarValePresente) e
// fica no feed do dono. A página só diz "enviamos por e-mail" quando o Resend devolveu o id.
//
// LOJA DA VITRINE (?loja=<slug>&s=<sessão>, 2026-10-05): a sacola paga no Stripe PRÓPRIO do negócio volta
// por aqui. O negócio sai da LOJA cadastrada (lib/loja.js · LOJAS), nunca da URL. Confere/registra e manda
// a cliente de volta para a vitrine NO MESMO host (303): ?loja=ok só com o pedido registrado; sem
// confirmação, ?loja=confirmando ("estamos confirmando") — nunca "pago" sem o Stripe dizer.
import { conferirVendaOnline } from "../lib/vendaOnlineNegocio.js";
import { lojaDe } from "../lib/loja.js";
import { ehNosso } from "../lib/dominio.js";

const T = {
  en: { package: ["Package purchased", "Thank you — your package is registered with the business. Just book your sessions."],
    giftcard: ["Payment received", "Thank you. Your gift card is issued now, and the business will send you the details."],
    giftcardEmail: ["Payment received", "Thank you. Your gift card is issued — we've emailed the code."],
    wait: ["Thank you", "We're confirming your payment with the bank. You'll hear from the business if anything is missing."] },
  pt: { package: ["Pacote comprado", "Obrigado — seu pacote está registrado com o estabelecimento. É só marcar as sessões."],
    giftcard: ["Pagamento recebido", "Obrigado. O seu vale-presente é emitido agora, e o estabelecimento envia os detalhes para você."],
    giftcardEmail: ["Pagamento recebido", "Obrigado. O seu vale-presente foi emitido — enviamos o código por e-mail."],
    wait: ["Obrigado", "Estamos confirmando o pagamento com o banco. Se faltar algo, o estabelecimento avisa."] },
  es: { package: ["Paquete comprado", "Gracias — su paquete quedó registrado con el negocio. Solo reserve sus sesiones."],
    giftcard: ["Pago recibido", "Gracias. Su tarjeta de regalo se emite ahora, y el negocio le envía los detalles."],
    giftcardEmail: ["Pago recibido", "Gracias. Su tarjeta de regalo fue emitida — le enviamos el código por correo."],
    wait: ["Gracias", "Estamos confirmando el pago con el banco. Si falta algo, el negocio le avisará."] },
};

/** Texto da página para o resultado da conferência. Pura (testada). */
export function textoDaVolta(lang, r) {
  const l = T[lang] ? lang : "en";
  if (!r || r.ok !== true) return T[l].wait;
  if (r.kind === "giftcard") return r.email && Array.isArray(r.email.sent) && r.email.sent.length ? T[l].giftcardEmail : T[l].giftcard;
  return r.kind === "package" ? T[l].package : T[l].wait;
}

/** Para onde a cliente da LOJA volta. Pura (testada). host = o host desta chamada (o da vitrine). */
export function voltaDaLoja(origem, host, loja, r) {
  const caminho = ehNosso(host) ? `/novo/${loja.slug}` : "/";
  return `${origem}${caminho}?loja=${r && r.ok === true && r.kind === "loja" ? "ok" : "confirmando"}#store`;
}

const pagina = (lang, [titulo, texto]) => new Response(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titulo}</title></head>
<body style="margin:0;background:#f7f4ee;font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;color:#2b2722;">
<div style="max-width:440px;margin:16vh auto 0;padding:34px 26px;background:#fff;border:1px solid #e7e1d6;border-radius:22px;text-align:center;">
<div style="font-size:30px;margin-bottom:8px;">✓</div><h1 style="font-size:23px;font-weight:700;margin:0 0 10px;">${titulo}</h1>
<p style="font-size:15px;color:#6b645a;line-height:1.7;margin:0;">${texto}</p></div></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const q = u.searchParams;
  const loja = q.has("loja") ? lojaDe(q.get("loja")) : null;
  if (loja) {
    const r = await conferirVendaOnline(env, { tenant: loja.email, sessionId: q.get("s") }).catch(() => ({ ok: false }));
    return new Response(null, { status: 303, headers: { Location: voltaDaLoja(u.origin, u.host, loja, r), "Cache-Control": "no-store" } });
  }
  const al = (request.headers.get("accept-language") || "").toLowerCase();
  const l = al.startsWith("pt") ? "pt" : al.startsWith("es") ? "es" : "en";
  const tenant = String(q.get("t") || "").trim().toLowerCase().slice(0, 200);
  const r = tenant.includes("@") ? await conferirVendaOnline(env, { tenant, sessionId: q.get("s") }) : { ok: false };
  return pagina(l === "pt" ? "pt-BR" : l, textoDaVolta(l, r));
}
