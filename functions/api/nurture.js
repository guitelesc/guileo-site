// Cloudflare Pages Function — POST /api/nurture → sends one branded nurture email by `step`.
// One dispatcher for the whole drip + the /admin 1-click buttons.
// Body: { to, name, business, lang, step }  · step ∈ welcome | proof | proposal | reengage
// The actual template-pick + Resend send lives in the exported sendNurtureStep() helper so the
// automatic drip engine (/api/lifecycle) sends the EXACT same emails as the manual buttons.
import { welcomeEmail, proofEmail, proposalEmail, reengageEmail } from "../lib/emailTemplates.js";
import { sameOrigin, rateLimited } from "../lib/guard.js";
import { unsubUrl } from "../lib/unsub.js";
import { svcJson } from "../lib/sb.js";

const STEPS = { welcome: welcomeEmail, proof: proofEmail, proposal: proposalEmail, reengage: reengageEmail };

// A lista de supressão é POR TENANT. O drip abaixo é da PRÓPRIA GUILEO falando com os leads dela,
// então o "tenant" é a Guileo — esta é a chave sob a qual o descadastro dela é guardado. Sem isso o
// drip da casa era o único motor de marketing da plataforma sem opt-out nenhum (auditoria A4).
const TENANT_GUILEO = "guileo";

// Shared sender — used by this manual endpoint AND functions/api/lifecycle.js (cron drip).
// Returns the same shape the endpoint always answered with; never throws on Resend errors.
export async function sendNurtureStep(env, { to, name, business, lang, step } = {}) {
  const s = STEPS[step] ? step : "welcome";
  const alvo = String(to || "").trim().toLowerCase();
  // SUPRESSÃO fail-closed: quem clicou "descadastrar" num e-mail da Guileo não recebe o próximo
  // degrau do drip. Sem lista confirmada, não mandamos — repetir para quem pediu para sair custa a
  // reputação do remetente COMPARTILHADO (queima a entrega de todos os clientes, não só a nossa).
  try {
    const sup = await svcJson(env, "email_suppressed_list", { p_secret: env.INGEST_SECRET || "", p_client_email: TENANT_GUILEO });
    if (!Array.isArray(sup)) return { ok: false, reason: "suppression unavailable" };
    if (sup.map((x) => String(x).toLowerCase()).includes(alvo)) return { ok: false, reason: "unsubscribed", suppressed: true };
  } catch { return { ok: false, reason: "suppression unavailable" }; }

  const unsub = await unsubUrl(env, "https://guileoai.com", TENANT_GUILEO, alvo).catch(() => "");
  const { subject, html } = STEPS[s]({
    name: (name || "there").toString().slice(0, 80),
    business: (business || "your business").toString().slice(0, 120),
    // pt/es have full template copy; anything else (incl. hi) falls back to EN by design.
    lang: lang === "pt" ? "pt" : lang === "es" ? "es" : "en",
    unsub,
  });
  const KEY = env.RESEND_API_KEY;
  const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
  if (!KEY) return { ok: false, reason: "no key" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [to], subject, html,
      // RFC 8058 — botão nativo de "Cancelar inscrição" no Gmail/Apple Mail.
      ...(unsub ? { headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
    }),
  });
  const data = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, step: s, id: data?.id || null } : { ok: false, error: data?.message || `HTTP ${r.status}` };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // SECURITY: only our own site (portal/admin) may trigger branded nurture mail.
    if (!sameOrigin(request)) return json({ ok: false, reason: "forbidden" }, 403);
    // Cap volume so a spoofed-Origin caller can't turn this into a bulk relay.
    if (await rateLimited(request, env, "nurture", 8)) return json({ ok: false, reason: "rate" }, 429);
    const b = await request.json();
    const to = (b.to || "").toString().trim();
    if (!to.includes("@")) return json({ ok: false, reason: "need a valid email" }, 400);
    return json(await sendNurtureStep(env, { to, name: b.name, business: b.business, lang: b.lang, step: b.step }));
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
export async function onRequestOptions() {
  return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
}
