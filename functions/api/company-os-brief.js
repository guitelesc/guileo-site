// Cloudflare Pages Function — GET/POST /api/company-os-brief?token=DIGEST_TOKEN
// O BRIEF DO DONO do Company OS: a Gui manda, uma vez por dia (via cron-tick), um resumo
// "sua empresa se operou hoje" — o que ela fez sozinha nas últimas 24h (reativou/nutriu/
// agradeceu/agendou) + o que precisa da SUA decisão (deals parados, tickets, churn).
// Só entrega pro OWNER_EMAIL (não vaza dado da companhia pra endereço arbitrário).
import { json, safeEq, isOwnerEmail } from "../lib/guard.js";
import { companyBriefEmail } from "../lib/emailTemplates.js";
import { emailsDoDonoMudos } from "../lib/avisarDono.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequest(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    let p = {};
    if (request.method === "POST") p = await request.json().catch(() => ({}));
    const q = (k) => p[k] ?? url.searchParams.get(k);

    // DIGEST-gated, FAIL-CLOSED: if DIGEST_TOKEN is unset OR the token doesn't match, refuse — the
    // brief carries cross-tenant company state and must never be reachable without the server token.
    if (!env.DIGEST_TOKEN || !safeEq((q("token") || "").toString(), env.DIGEST_TOKEN)) return json({ ok: false, error: "unauthorized" }, 401);

    const to = (q("to") || env.OWNER_EMAIL || "smart@guileoai.com").toString().trim();
    // SEGURANÇA: o brief carrega o estado da companhia — só pro inbox do dono.
    if (!isOwnerEmail(to, env)) return json({ ok: false, error: "recipient not allowed" }, 403);
    const lang = q("lang") === "pt" ? "pt" : "en";

    // Puxa o brief cross-tenant (INGEST-gated server-side).
    const r = await fetch(`${SB}/rest/v1/rpc/company_os_autobrief`, {
      method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "" }),
    });
    const data = r.ok ? await r.json().catch(() => null) : null;
    if (!data || data.error) return json({ ok: false, error: "brief unavailable" }, 500);

    const dateLabel = new Date().toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", { weekday: "long", day: "numeric", month: "short" });
    const { subject, html } = companyBriefEmail({ dateLabel, did: data.did || {}, needs: data.needs || {}, lang });

    let sent = false;
    if (env.RESEND_API_KEY && !(await emailsDoDonoMudos(env))) {
      const er = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }),
      });
      sent = er.ok;
    }
    return json({ ok: true, sent, to: sent ? to : undefined, did: data.did, needs: data.needs, note: env.RESEND_API_KEY ? undefined : "RESEND_API_KEY não configurada — brief montado mas não enviado" });
  } catch (e) { return json({ ok: false, error: String(e).slice(0, 160) }, 400); }
}
