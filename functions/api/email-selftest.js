// Cloudflare Pages Function — POST /api/email-selftest  (admin-token gated)
//
// PROVA QUE O E-MAIL DE CONFIRMAÇÃO SAI — isolado da ligação.
//
// POR QUE EXISTE: em 2026-08-05 o Luis perguntou "por que não chegou e-mail?" e a resposta
// honesta era "não sei" — porque na ligação dela a Gui nunca chegou a marcar, então o e-mail
// nem foi tentado. Sem separar as duas coisas, todo diagnóstico vira discussão: é o e-mail
// que está quebrado, ou é a agente que não marcou? Esta rota responde a metade do e-mail
// sozinha, em 2 segundos, sem precisar de outra ligação.
//
// ── SEGURANÇA ────────────────────────────────────────────────────────────────
// Só manda pro DONO (ownerEmails do guard.js). Um endpoint de teste que aceita
// destinatário livre é um relay de phishing com outro nome — mesmo gated por admin,
// mesmo "só pra teste". O destino é fixo por construção, não por confiança.
import { json, safeEq, isOwnerEmail, ownerEmails } from "../lib/guard.js";
import { appointmentEmail } from "../lib/emailTemplates.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));

    const vr = await fetch(`${SB}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: (b.token || "").toString(), p_email: "" }),
    });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    if (!env.RESEND_API_KEY) return json({ ok: false, ready: false, note: "RESEND_API_KEY não configurada" }, 503);

    // Destino: SEMPRE o dono. Se pediram outro, recusa em voz alta em vez de silenciosamente
    // trocar — quem testa precisa saber pra onde o e-mail foi.
    const asked = (b.to || "").toString().trim().toLowerCase();
    if (asked && !isOwnerEmail(asked, env)) {
      return json({ error: "destinatário não permitido — este teste só envia para o dono", permitidos: [...ownerEmails(env)] }, 403);
    }
    const to = asked || [...ownerEmails(env)][0];

    // Mesmo template que a agente usa ao confirmar uma reserva de verdade.
    const kind = ["book", "cancel", "reschedule"].includes(b.kind) ? b.kind : "book";
    const tpl = appointmentEmail({
      kind,
      name: (b.name || "Luis").toString(),
      business: (b.business || "Natura Spa + Salon").toString(),
      service: (b.service || "Massage 60 min").toString(),
      whenLabel: (b.whenLabel || "Thursday, Aug 7 · 11:00 AM").toString(),
      pro: (b.pro || "Astoria Team").toString(),
      location: (b.location || "Astoria").toString(),
      ref: (b.ref || "TESTE-SELFTEST").toString(),
      lang: (b.lang || "en").toString(),
    });

    const mr = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [to], subject: tpl.subject, html: tpl.html }),
    });
    // Checar o resultado é o ponto da rota: "mandei" sem conferir foi o que criou este problema.
    if (!mr.ok) {
      const detail = (await mr.text().catch(() => "")).slice(0, 200);
      return json({ ok: false, enviado: false, status: mr.status, detail }, 503);
    }
    const rid = await mr.json().catch(() => ({}));
    return json({ ok: true, enviado: true, para: to, assunto: tpl.subject, kind, resend_id: rid.id || null });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
