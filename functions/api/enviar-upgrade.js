// Cloudflare Pages Function — POST /api/enviar-upgrade
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// MANDA o e-mail do Website Upgrade para o dono do negócio. Um caminho só, reusável para todo
// prospect — antes cada envio era montado à mão, e e-mail montado à mão é como nasce HTML ad-hoc
// fora do emailTemplates.js (proibido nesta base).
//
// PORTÃO: `x-guileo-secret` = INGEST_SECRET (servidor-a-servidor). Isto MANDA e-mail para uma
// pessoa real: nunca pode ficar atrás de sameOrigin, que qualquer aba do site satisfaz.
//
// ⚠️ CHECA O RESULTADO DO ENVIO. O Resend responde 4xx em domínio não verificado, endereço ruim e
// rate limit — `r.ok` ignorado já produziu dois "sucessos" invisíveis nesta base. Sem o id do
// e-mail, não houve envio.
import { json, safeEq } from "../lib/guard.js";
import { websiteUpgradeEmail } from "../lib/emailTemplates.js";

export async function onRequestPost({ request, env }) {
  const ING = (env.INGEST_SECRET || "").toString();
  if (!ING || !safeEq((request.headers.get("x-guileo-secret") || "").toString(), ING)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.RESEND_API_KEY) return json({ ok: false, error: "RESEND_API_KEY ausente" }, 503);

  const b = await request.json().catch(() => ({}));
  const to = (b.to || "").toString().trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(to)) return json({ ok: false, error: "destinatario invalido" }, 400);

  const { subject, html } = websiteUpgradeEmail(b);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }),
  });
  const corpo = await r.text().catch(() => "");
  if (!r.ok) return json({ ok: false, enviado: false, motivo: `resend ${r.status}: ${corpo.slice(0, 160)}` }, 502);
  let id = ""; try { id = (JSON.parse(corpo) || {}).id || ""; } catch { /* */ }
  // "ok" sem id do que foi criado é promessa sem lastro.
  if (!id) return json({ ok: false, enviado: false, motivo: "resend aceitou sem devolver id" }, 502);
  return json({ ok: true, enviado: true, id, para: to, assunto: subject });
}
