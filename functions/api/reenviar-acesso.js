// ═══ REENVIAR O ACESSO DE UM CLIENTE ═════════════════════════════════════════════════════════
// POST /api/reenviar-acesso  { token: <senha do /admin>, email: <cliente> }
//
// POR QUE ESTE ARQUIVO EXISTE (2026-08-20): a chave de acesso ao cockpit só saía UMA vez, no
// e-mail de nascimento do `onboard-client.js`. Cliente que perdeu o e-mail, caiu no spam ou trocou
// de endereço ficava sem caminho — e a única saída era o Luis abrir o banco. A Natura Spa está
// exatamente nesse estado: cockpit pronto, 186 eventos, 34 ligações, login provado, e a dona sem
// como entrar.
//
// 🚨 A CHAVE NUNCA APARECE PARA NINGUÉM ALÉM DO DONO DO NEGÓCIO.
// Ela é lida do banco AQUI DENTRO e vai direto para o corpo do e-mail. Não volta na resposta HTTP,
// não é logada, e não passa por nenhuma conversa. Chave que passa por um canal humano é chave
// vazada — vale inclusive para o próprio Luis, que tem o /admin para isso.
//
// 🚨 O DESTINATÁRIO É SEMPRE O E-MAIL CADASTRADO DO CLIENTE, nunca um endereço vindo do corpo.
// Aceitar destinatário do corpo transformaria isto num relé de credencial: bastaria a senha do
// admin vazar para alguém pedir a chave de qualquer cliente no próprio endereço. O `email` do
// corpo serve só para ESCOLHER de quem é a conta; para onde vai é decidido pelo banco.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";
import { welcomeSelfServeEmail } from "../lib/emailTemplates.js";
import { emitFailure } from "../lib/failure.js";

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    // 6/min: reenvio é ação rara e deliberada. Limite baixo também trava tentativa em massa.
    if (await rateLimited(request, env, "reenviar-acesso", 6)) return json({ error: "rate" }, 429);

    const b = await request.json().catch(() => ({}));
    const token = (b.token || "").toString();
    const alvo = (b.email || "").toString().trim().toLowerCase();

    // 🚨 PORTÃO ANTES DE VALIDAR CAMPO (corrigido 2026-08-21). Este arquivo checava o formato do
    // e-mail primeiro — então quem não tem a senha recebia "e-mail do cliente inválido" em vez de
    // 401, e aprendia de graça QUAL campo o endpoint espera. A regra já estava escrita em
    // `onboard-client.js` e eu não a segui aqui. Sonda sem credencial vê 401 e mais nada.
    // PORTÃO DO /admin — o mesmo `blitz_stats` que onboard-draft e onboard-client usam.
    // Ele LEVANTA com token errado (verificado em produção: 401 nos dois endpoints), então
    // um não-200 aqui significa "não autorizado", nunca "não deu para checar".
    const vr = await svcRpc(env, "blitz_stats", { p_token: token, p_email: "" });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    // só DEPOIS de autenticado o formato do campo importa
    if (!alvo || !/.+@.+\..+/.test(alvo)) return json({ ok: false, motivo: "e-mail do cliente inválido" }, 400);

    // A conta do cliente, com a chave. Lida aqui e usada aqui.
    const cr = await svcRpc(env, "client_access_for_resend", { p_secret: env.INGEST_SECRET || "", p_email: alvo });
    if (!cr.ok) return json({ ok: false, motivo: `não consegui ler a conta (HTTP ${cr.status})` }, 502);
    const c = await cr.json().catch(() => null);
    if (!c || c.ok !== true) return json({ ok: false, motivo: c?.motivo || "cliente não encontrado" }, 404);

    if (!env.RESEND_API_KEY) return json({ ok: false, motivo: "envio de e-mail não configurado neste ambiente" }, 503);

    const { subject, html } = welcomeSelfServeEmail({
      name: c.nome || alvo.split("@")[0],
      business: c.negocio || "",
      lang: c.idioma || "en",
      plan: c.plano || "",
      code: c.chave,                 // ← a chave entra SÓ aqui
      credits: Number(c.creditos) || 0,
      number: c.numero || "",
    });

    const mr = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [alvo], subject, html }),
    });
    // 🚨 "ok" sem comprovante é promessa sem lastro: o id da Resend é a prova de que saiu.
    if (!mr.ok) {
      const detalhe = (await mr.text().catch(() => "")).slice(0, 200);
      await emitFailure(env, "reenvio_acesso_falhou", alvo, `Resend recusou o reenvio para ${alvo}: HTTP ${mr.status}`, { detalhe }).catch(() => {});
      return json({ ok: false, motivo: `o e-mail não saiu (HTTP ${mr.status})`, detalhe }, 502);
    }
    const env_id = (await mr.json().catch(() => ({})))?.id || null;
    if (!env_id) return json({ ok: false, motivo: "a Resend aceitou mas não devolveu id — não dá para afirmar que saiu" }, 502);

    // Devolve para QUEM foi e o id do envio. Nunca a chave.
    return json({ ok: true, enviado_para: alvo, negocio: c.negocio || null, envio_id: env_id });
  } catch (e) { return json({ ok: false, motivo: String(e).slice(0, 160) }, 400); }
}
