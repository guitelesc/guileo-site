// Cloudflare Pages Function — POST /api/parceiro-acesso  (ACESSO NOMINAL DE PARCEIRO · CR-03, 2026-10-13)
//
// Duas portas, como o /api/projeto:
//   · PARCEIRO: { action: "me" | "otp" | "confirmar", access_token, tenant?, otp? }
//     O access_token é a sessão Supabase Auth do parceiro (e-mail + senha). O servidor pergunta ao
//     Supabase quem é esse token (nunca confia no e-mail do corpo), confere na tabela parceiros,
//     manda o código de 6 dígitos ao e-mail do parceiro e, só com o código certo, devolve a chave de
//     conexão do cliente escolhido. Tudo registrado em parceiro_eventos.
//   · ADMIN (Luis): { action: "admin_listar" | "admin_criar" | "admin_revogar" | "admin_tenants",
//     admin_token, ... } — senha do /admin (blitz_stats), depois a RPC com o SCHED_SECRET. Criar =
//     usuário Supabase Auth (API admin, chave de serviço) + linha em parceiros; devolve a senha inicial
//     UMA vez. Revogar = linha travada + usuário apagado.
//
// Fail-closed: sem SUPABASE_SERVICE_ROLE o admin não cria ninguém (devolve erro claro, não "ok").
import { json, rateLimited } from "../lib/guard.js";
import { svcJson, sbKey, SB_URL } from "../lib/sb.js";
import { OTP_OK, gerarOtp, hashOtp, senhaInicial } from "../lib/parceiroAcesso.js";
import { partnerCodeEmail } from "../lib/emailTemplates.js";

const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// mesma checagem de admin do /api/projeto e do /api/sync-agent
async function adminOk(token) {
  if (!token || String(token).length < 6) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: String(token).trim(), p_email: "" }),
    });
    return r.ok;
  } catch { return false; }
}

// quem é este token? (o Supabase responde; o corpo da requisição não manda)
async function emailDoToken(token) {
  if (!token || String(token).length < 20) return "";
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return "";
    const u = await r.json().catch(() => null);
    return String(u?.email || "").trim().toLowerCase();
  } catch { return ""; }
}

async function enviarCodigo(env, { para, nome, otp, tenantNome }) {
  if (!env.RESEND_API_KEY) return { ok: false, motivo: "RESEND_API_KEY ausente" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: para, ...partnerCodeEmail({ name: nome, code: otp, tenantName: tenantNome }) }),
    });
    const d = await r.json().catch(() => ({}));
    return r.ok && d.id ? { ok: true, id: d.id } : { ok: false, motivo: `resend ${r.status}` };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 80) }; }
}

function resposta(d) {
  if (d && d.ok) return json(d);
  if (d && d.erro) return json(d, ["parceiro", "tenant"].includes(d.erro) ? 403 : 409);
  return json({ ok: false, erro: "indisponivel", detalhe: d && (d.detalhe || d.erro_http) }, 503);
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, erro: "json" }, 400); }
  const action = String(b.action || "");
  const secret = env.SCHED_SECRET || "";

  // ── ADMIN ──
  if (action.startsWith("admin_")) {
    if (await rateLimited(request, env, "parceiro-admin", 30)) return json({ ok: false, erro: "devagar" }, 429);
    if (!(await adminOk(b.admin_token))) return json({ ok: false, erro: "unauthorized" }, 401);
    const service = sbKey(env);
    const temServico = !!(env.SUPABASE_SERVICE_ROLE && String(env.SUPABASE_SERVICE_ROLE).trim());

    if (action === "admin_listar") return resposta(await svcJson(env, "parceiro_admin", { p_secret: secret, p_acao: "listar" }));

    if (action === "admin_criar") {
      const email = String(b.email || "").trim().toLowerCase(), nome = String(b.nome || "").trim();
      const tenants = Array.isArray(b.tenants) ? b.tenants.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : [];
      if (!email.includes("@") || !nome) return json({ ok: false, erro: "dados" }, 400);
      if (!temServico) return json({ ok: false, erro: "service_role", detalhe: "SUPABASE_SERVICE_ROLE ausente no Cloudflare — não dá para criar o usuário" }, 503);
      // 1) usuário Supabase Auth (e-mail confirmado; senha inicial entregue uma vez)
      const senha = senhaInicial();
      const ur = await fetch(`${SB_URL}/auth/v1/admin/users`, {
        method: "POST", headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: senha, email_confirm: true, user_metadata: { name: nome, parceiro: true, empresa: String(b.empresa || "Scale Pods") } }),
      });
      const ud = await ur.json().catch(() => ({}));
      let auth_uid = ud?.id || "";
      // já existia? (recriar o mesmo parceiro) — procura pelo e-mail
      if (!auth_uid && /already|exists|registered/i.test(JSON.stringify(ud))) {
        const lr = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=1000`, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
        const ld = await lr.json().catch(() => ({}));
        auth_uid = (ld?.users || []).find((u) => String(u.email || "").toLowerCase() === email)?.id || "";
      }
      if (!auth_uid) return json({ ok: false, erro: "auth", detalhe: String(ud?.msg || ud?.message || ud?.error_description || ur.status).slice(0, 160) }, 502);
      // 2) linha do parceiro (valida os tenants no banco)
      const r = await svcJson(env, "parceiro_admin", { p_secret: secret, p_acao: "criar", p_dados: { nome, email, empresa: String(b.empresa || "Scale Pods"), tenants, auth_uid } });
      if (!(r && r.ok)) return resposta(r);
      return json({ ...r, senha_inicial: ud?.id ? senha : null, usuario_ja_existia: !ud?.id });
    }

    if (action === "admin_revogar") {
      const r = await svcJson(env, "parceiro_admin", { p_secret: secret, p_acao: "revogar", p_dados: { id: String(b.id || "") } });
      if (!(r && r.ok)) return resposta(r);
      let usuario_apagado = false;
      if (r.auth_uid && temServico) {
        const dr = await fetch(`${SB_URL}/auth/v1/admin/users/${r.auth_uid}`, { method: "DELETE", headers: { apikey: service, Authorization: `Bearer ${service}` } });
        usuario_apagado = dr.ok;
      }
      return json({ ok: true, usuario_apagado });
    }

    if (action === "admin_tenants") {
      const tenants = Array.isArray(b.tenants) ? b.tenants.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : [];
      return resposta(await svcJson(env, "parceiro_admin", { p_secret: secret, p_acao: "tenants", p_dados: { id: String(b.id || ""), tenants } }));
    }
    return json({ ok: false, erro: "acao" }, 400);
  }

  // ── PARCEIRO ──
  if (!["me", "otp", "confirmar"].includes(action)) return json({ ok: false, erro: "acao" }, 400);
  if (await rateLimited(request, env, "parceiro-" + action, action === "confirmar" ? 10 : 20, 600)) return json({ ok: false, erro: "devagar" }, 429);
  const email = await emailDoToken(b.access_token);
  if (!email) return json({ ok: false, erro: "unauthorized" }, 401);

  if (action === "me") return resposta(await svcJson(env, "parceiro_me_svc", { p_email: email }));

  if (action === "otp") {
    const tenant = String(b.tenant || "").trim().toLowerCase();
    if (!tenant.includes("@")) return json({ ok: false, erro: "tenant" }, 400);
    const otp = gerarOtp();
    const r = await svcJson(env, "parceiro_otp_emitir_svc", { p_email: email, p_tenant: tenant, p_hash: await hashOtp(email, otp) });
    if (!(r && r.ok)) return resposta(r);
    const env_ = await enviarCodigo(env, { para: email, nome: r.nome, otp, tenantNome: String(b.tenant_nome || tenant) });
    // SUCESSO PRECISA DE COMPROVANTE: sem id do Resend não dizemos "enviado"
    if (!env_.ok) return json({ ok: false, erro: "email", detalhe: env_.motivo }, 503);
    return json({ ok: true, enviado: true, para: email.replace(/^(.).*(@.*)$/, "$1…$2"), email_id: env_.id });
  }

  // confirmar
  const otp = String(b.otp || "").trim();
  if (!OTP_OK.test(otp)) return json({ ok: false, erro: "otp" }, 400);
  const r = await svcJson(env, "parceiro_otp_conferir_svc", { p_email: email, p_hash: await hashOtp(email, otp) });
  if (!(r && r.ok)) return json(r && r.erro ? r : { ok: false, erro: "indisponivel" }, r && r.erro ? 403 : 503);
  return json({ ok: true, tenant: r.tenant, nome: r.nome, empresa: r.empresa, key: r.key, email_parceiro: email });
}
