// Cloudflare Pages Function — POST /api/quote-email → a logged-in seller emails the quote they just
// built TO THEMSELVES (forward model). The recipient is ALWAYS the seller's OWN address passed as
// `to`; we never accept cc/bcc or any extra recipients, so this can't be turned into a phishing relay
// to an attacker-chosen victim. The seller then forwards the branded email on to their client.
import { sameOrigin, rateLimited } from "../lib/guard.js";
import { sellerQuoteEmail } from "../lib/emailTemplates.js";
import { verifySession } from "../lib/sellerSession.js";

// Mirror lead.js: a self-contained JSON helper with the same hardening headers.
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });

// Syntactic email validation — single recipient, no spaces, one @, a dotted domain. Deliberately
// strict-ish: we only ever send to this address, so a malformed value is rejected outright.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // SECURITY: only our own site may call this (blocks header-less curl spam).
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    // per-IP brake — 8/min is plenty for a seller emailing themselves a quote.
    if (await rateLimited(request, env, "quote-email", 8)) return json({ error: "too many requests" }, 429);

    const body = await request.json();
    const s = (v, n) => (v == null ? "" : v.toString().slice(0, n));

    // 🚨 O DESTINATÁRIO VEM DA SESSÃO ASSINADA, NUNCA DO CORPO (corrigido 2026-08-20).
    // O comentário no topo deste arquivo AFIRMAVA que "o destinatário é SEMPRE o endereço do
    // próprio vendedor" — mas isso era uma promessa do cliente, não uma checagem do servidor.
    // O gate era só `sameOrigin` + limite por IP, e o `to` vinha do body: qualquer visitante da
    // guileoai.com mandava e-mail com a MARCA GUILEO, com 4000 caracteres controlados, para
    // qualquer endereço. É a lição "status/comentário não é autenticação" na forma mais literal:
    // a garantia estava escrita em prosa, não em código.
    // Agora exige o crachá HMAC do vendedor e usa o e-mail QUE ELE ASSINOU. O `to` do corpo é
    // ignorado de propósito — aceitar mesmo "só para conferir" reabre o relé.
    const sid = s(body.sid, 400);
    const to = (await verifySession(env, sid).catch(() => null)) || "";
    if (!to) return json({ error: "unauthorized", motivo: "faça login de novo para enviar o orçamento" }, 401);
    const sellerName = s(body.sellerName, 80);
    const clientName = s(body.clientName, 80);
    const summary = s(body.summary, 4000);
    const lang = s(body.lang, 5) || "en";

    // O e-mail vem do crachá, então já é o do vendedor; a validação sintática continua como
    // rede de segurança contra um crachá antigo com formato estranho.
    if (!EMAIL_RE.test(to)) return json({ error: "invalid recipient" }, 400);

    // Graceful no-op if email isn't wired up yet — never 500, never block the seller's flow.
    if (!env.RESEND_API_KEY) return json({ ok: false, note: "email unavailable" });

    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    const mail = sellerQuoteEmail({ sellerName, clientName, summary, lang });

    const er = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      // SINGLE recipient only — the seller's own `to`. No cc/bcc accepted or forwarded.
      body: JSON.stringify({ from: FROM, to: [to], subject: mail.subject, html: mail.html }),
    });
    if (!er.ok) return json({ ok: false, note: "send failed" });

    return json({ ok: true, enviado_para: to });
  } catch {
    return json({ error: "bad request" }, 400);
  }
}
