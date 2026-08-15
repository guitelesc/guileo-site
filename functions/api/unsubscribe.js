// Cloudflare Pages Function — /api/unsubscribe?c=<client>&e=<contact>&t=<token>
// Public one-click email opt-out (CAN-SPAM / RFC 8058). The token is an HMAC of (client|contact)
// keyed by the server secret, so a link can't be forged to opt out a third party or enumerate
// contacts. On a valid token we add (client, contact) to email_suppressions (service_role RPC) so
// that client's future campaigns skip this address. GET renders a confirmation page; POST is the
// List-Unsubscribe-Post one-click path (returns 200, no page). Never reveals whether the pair exists.
import { unsubVerify } from "../lib/unsub.js";
import { svcJson } from "../lib/sb.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const page = (title, msg, accent = "#FF8A33") => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#161512;color:#efece6;font-family:'Inter',-apple-system,Segoe UI,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;">
<div style="max-width:440px;padding:40px 28px;text-align:center;">
<div style="width:46px;height:46px;border-radius:13px;background:${accent}22;color:${accent};display:inline-flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:18px;">✓</div>
<h1 style="font-size:22px;font-weight:800;margin:0 0 10px;">${title}</h1>
<p style="font-size:14.5px;line-height:1.6;color:#b8b2a7;margin:0;">${msg}</p>
<a href="https://guileoai.com" style="display:inline-block;margin-top:22px;font-size:12px;color:#7c766a;text-decoration:none;">powered by Guileo</a>
</div></body></html>`;

async function handle(env, url) {
  const client = (url.searchParams.get("c") || "").trim().toLowerCase();
  const contact = (url.searchParams.get("e") || "").trim().toLowerCase();
  const token = (url.searchParams.get("t") || "").trim();
  const ok = client && contact && token && (await unsubVerify(env, client, contact, token));
  if (!ok) return { ok: false };
  // "SUCESSO PRECISA DE COMPROVANTE" (auditoria A4, 2026-08-11): antes isto era
  // `await svcRpc(...)` e devolvia ok:true SEM olhar a resposta. email_suppress_add é
  // service_role-only (anon = 42501) — se o SUPABASE_SERVICE_ROLE sumisse do ambiente, ou a
  // RPC não existisse, a pessoa lia "Você foi descadastrado" e NADA tinha sido gravado: ela
  // continuaria recebendo. Numa página de opt-out isso não é um bug de UX, é uma promessa
  // legal quebrada. Agora só dizemos "descadastrado" quando o banco confirmou `true`.
  try {
    const r = await svcJson(env, "email_suppress_add", { p_secret: env.INGEST_SECRET || "", p_client_email: client, p_contact_email: contact });
    if (r === true) return { ok: true, contact };
    return { ok: false, falhou: true };
  } catch { return { ok: false, falhou: true }; }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const r = await handle(env, url);
  // Três desfechos DISTINTOS — não podemos dizer "pronto" quando o banco não confirmou.
  const html = r.ok
    ? page("You're unsubscribed", `<b>${esc(r.contact)}</b> won't receive marketing emails from this business anymore. You can still be contacted about bookings and orders you make.`)
    : r.falhou
      ? page("We couldn't complete that", "Your link is valid, but we couldn't record the opt-out just now. Please try again in a minute — or reply to the email asking to be removed and we'll do it by hand.", "#E5484D")
      : page("Link expired", "This unsubscribe link is invalid or has expired. If you keep receiving unwanted email, reply to the message and ask to be removed.", "#E5484D");
  return new Response(html, { status: r.ok ? 200 : (r.falhou ? 503 : 400), headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

// RFC 8058 one-click (mail clients POST to the List-Unsubscribe-Post URL). No page — just 200/400.
export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const r = await handle(env, url);
  // RFC 8058: 5xx faz o cliente de e-mail tentar de novo — é o que queremos quando o registro
  // falhou. 400 só para link realmente inválido (retry não ajudaria).
  return new Response(r.ok ? "unsubscribed" : (r.falhou ? "retry" : "invalid"), { status: r.ok ? 200 : (r.falhou ? 503 : 400), headers: { "Content-Type": "text/plain" } });
}
