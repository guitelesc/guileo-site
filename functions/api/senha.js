// POST /api/senha  { email, lang }  — "esqueci a senha" da Central, pela NOSSA via de e-mail.
//
// POR QUE EXISTE (2026-10-01): o envio padrão do Supabase tem cota baixa por hora. O dono do Natura
// pediu a troca duas vezes e na segunda viu "Error sending recovery email" — trancado fora da
// própria Central. Aqui o servidor pede ao Supabase só o LINK (admin/generate_link, que não manda
// e-mail nenhum) e quem envia é a Resend, com a marca.
//
// ⚠️ RESPOSTA NEUTRA DE PROPÓSITO: conta que existe e conta que não existe recebem o mesmo {ok:true}.
// Esta rota não pode virar detector de "quem é cliente da Guileo".
// ⚠️ TRAVA DE 60s POR E-MAIL: generate_link não tem cota; sem a trava, qualquer um encheria a caixa
// de alguém de e-mails nossos.
// 503 { ok:false, motivo } = esta via não está disponível → a tela cai para o envio do Supabase.
import { SB_URL } from "../lib/sb.js";
import { passwordResetEmail } from "../lib/emailTemplates.js";

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const DESTINOS = /^https:\/\/([a-z0-9-]+\.)?guileoai\.(com|pages\.dev)$/;

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch { return json({ ok: false, motivo: "corpo inválido" }, 400); }
  const email = String(b.email || "").trim().toLowerCase();
  const lang = ["pt", "es", "en"].includes(b.lang) ? b.lang : "en";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json({ ok: false, motivo: "e-mail inválido" }, 400);

  const svc = String(env.SUPABASE_SERVICE_ROLE || "").trim();
  if (!svc || !env.RESEND_API_KEY) return json({ ok: false, motivo: "via própria indisponível" }, 503);

  // Trava de 60s por e-mail (cache da borda; some sozinha).
  const trava = new Request(`https://trava.guileoai.com/senha/${encodeURIComponent(email)}`);
  try {
    if (await caches.default.match(trava)) return json({ ok: true, aguarde: true });
    await caches.default.put(trava, new Response("1", { headers: { "Cache-Control": "max-age=60" } }));
  } catch { /* sem cache → segue sem trava */ }

  // DIAGNÓSTICO (só com x-guileo-secret = INGEST_SECRET): devolve em que etapa parou e o id da Resend.
  // Sem a senha, a resposta continua neutra — o diagnóstico nunca vaza quem tem conta.
  const diag = !!env.INGEST_SECRET && request.headers.get("x-guileo-secret") === env.INGEST_SECRET;
  const origem = new URL(request.url).origin;
  const volta = `${DESTINOS.test(origem) ? origem : "https://guileoai.com"}/portal`;

  let link = "";
  try {
    const r = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: { apikey: svc, Authorization: `Bearer ${svc}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "recovery", email, redirect_to: volta }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) return json({ ok: false, motivo: "chave do servidor recusada" }, 503);
    link = d?.action_link || d?.properties?.action_link || "";
    // Conta inexistente → Supabase responde erro; para quem pediu, a resposta é a mesma.
    if (!link) return json(diag ? { ok: true, etapa: "sem_link", supabase_status: r.status, supabase_msg: String(d?.msg || d?.message || d?.error_description || "").slice(0, 160) } : { ok: true });
  } catch {
    return json({ ok: false, motivo: "Supabase fora do ar" }, 503);
  }

  const m = passwordResetEmail({ link, lang });
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: email, subject: m.subject, html: m.html }),
    });
    // Confere o retorno: sem isto, "enviado" seria promessa (regra da casa).
    const recibo = await r.json().catch(() => ({}));
    if (!r.ok) return json({ ok: false, motivo: "envio recusado", ...(diag ? { resend_status: r.status, resend_msg: String(recibo?.message || "").slice(0, 160) } : {}) }, 503);
    return json(diag ? { ok: true, etapa: "enviado", envio_id: recibo?.id || null, volta } : { ok: true });
  } catch {
    return json({ ok: false, motivo: "envio falhou" }, 503);
  }
}
