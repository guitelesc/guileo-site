// Cloudflare Pages Function — O CARTEIRO DO GROWTH REPORT (2026-08-18)
//
// O motor de avaliação (/api/avaliacao) já produz o documento e a página /apresentacao/:id já o
// mostra. Faltava a ponte: o dono do negócio não abre uma página que ninguém mandou pra ele.
// Esta rota pega uma avaliação JÁ GRAVADA (pelo id), renderiza o e-mail de marca do cliente e
// entrega na caixa dele. PRIMEIRO CASO REAL: Lilian, Natura Spa + Salon (score 69).
//
// ── PORTA ÚNICA, FECHADA ──────────────────────────────────────────────────────────────────────
// POST {id, para, lang?, ...} + sid de vendedor OU senha do /admin OU DIGEST_TOKEN OU
// x-guileo-secret = INGEST_SECRET. Exatamente o mesmo gate do irmão /api/avaliacao — esta rota
// MANDA E-MAIL PRA TERCEIRO, então nunca pode ficar aberta: seria um canhão de spam com a nossa
// reputação de domínio na frente.
//
// ?dry=1 → renderiza e devolve o HTML SEM enviar. É como se prova o template sem queimar a caixa
// de entrada de ninguém (e sem gastar cota do Resend).
//
// ⚠️ CHECA O RETORNO DO ENVIO (lei da casa, de dois incidentes reais): fetch disparado não é
// e-mail entregue. Só 2xx do Resend conta como enviado; qualquer outra coisa devolve o status e o
// corpo REAL do erro, nunca um "ok" otimista.
import { json, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { verifySession } from "../lib/sellerSession.js";
import { growthReportEmail } from "../lib/emailTemplates.js";

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || "").trim());

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (request.method !== "POST") return json({ error: "method" }, 405);

  const b = await request.json().catch(() => ({}));

  // ── GATE (cópia fiel do /api/avaliacao) ────────────────────────────────────────────────────
  // ⚠️ LÊ A RESPOSTA da RPC _admin_ok, não o status HTTP — a lição do /api/encaminhar (2026-08-15):
  // `.then(r => r.ok)` sobre uma RPC que devolve booleano abre a porta pra qualquer um.
  const tok = (b.token || request.headers.get("x-guileo-secret") || "").toString();
  let ok = !!(await verifySession(env, (b.sid || "").toString()));
  if (!ok) ok = !!env.INGEST_SECRET && safeEq(tok, env.INGEST_SECRET);
  if (!ok && tok) {
    if (env.DIGEST_TOKEN && safeEq(tok, env.DIGEST_TOKEN)) ok = true;
    else {
      const a = await svcJson(env, "_admin_ok", { p_token: tok }).catch(() => null);
      ok = a === true || a?.ok === true;
    }
  }
  if (!ok) return json({ error: "unauthorized", dica: "crachá de vendedor (sid), senha do /admin ou DIGEST_TOKEN" }, 401);

  const id = (b.id || "").toString().trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "informe o id da avaliação" }, 400);

  const dry = url.searchParams.get("dry") === "1" || b.dry === true;
  const para = (b.para || "").toString().trim().toLowerCase().slice(0, 160);
  // No modo real o destinatário é obrigatório e tem que PARECER e-mail antes de sair daqui —
  // endereço inválido vira 4xx do Resend lá na frente e a rota já teria dito "enviado".
  if (!dry && !isEmail(para)) return json({ error: "informe um e-mail válido em `para`" }, 400);

  // ── A AVALIAÇÃO GRAVADA ────────────────────────────────────────────────────────────────────
  // Sem p_marcar: abrir o e-mail não é o dono abrir o relatório. Marcar aqui contaminaria a
  // métrica de leitura da página com um evento que foi nosso, não dele.
  const d = await svcJson(env, "avaliacao_get", { p_id: id, p_marcar: false });
  const av = d && d.payload;
  if (!av) return json({ error: "avaliação não encontrada", id }, 404);

  const lang = ["pt", "en", "es"].includes((b.lang || "").toString()) ? b.lang.toString() : "pt";
  const accent = (b.accent || "").toString().slice(0, 9);
  const logo = (b.logo || "").toString().slice(0, 400);
  const agentName = (b.agente || b.agentName || "Gui").toString().slice(0, 40);
  // O link do e-mail é o MESMO link curto/pleno que o dono já recebe por outros canais: quem
  // chama passa `link` (ex.: https://guileoai.com/natura); sem ele, montamos a URL canônica da
  // página com a marca embutida, para o relatório abrir já com a cor e o nome da agente certos.
  const qs = [accent ? `accent=${encodeURIComponent(accent)}` : "", agentName && agentName !== "Gui" ? `agente=${encodeURIComponent(agentName)}` : "", logo ? `logo=${encodeURIComponent(logo)}` : ""].filter(Boolean).join("&");
  const link = /^https?:\/\//i.test(String(b.link || ""))
    ? String(b.link).slice(0, 400)
    : `${url.origin}/apresentacao/${id}${qs ? `?${qs}` : ""}`;

  const tpl = growthReportEmail({
    business: av.business || "", agentName, score: av.score_geral,
    aspectos: av.aspectos || [], previsoes: av.previsoes || {}, estrategia: av.estrategia || [],
    link, logo, accent, lang,
  });

  // ── PROVA SEM ENVIO ────────────────────────────────────────────────────────────────────────
  if (dry) return json({ ok: true, enviado: false, dry: true, assunto: tpl.subject, link, html: tpl.html });

  if (!env.RESEND_API_KEY) return json({ ok: false, enviado: false, erro: "RESEND_API_KEY ausente" }, 503);
  let r;
  try {
    r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [para], subject: tpl.subject, html: tpl.html }),
    });
  } catch (e) {
    return json({ ok: false, enviado: false, erro: String(e).slice(0, 200) }, 502);
  }
  // "ok" sem comprovante é promessa sem lastro: só 2xx é envio, e o id do Resend é o recibo.
  if (!r.ok) {
    const detail = (await r.text().catch(() => "")).slice(0, 300);
    return json({ ok: false, enviado: false, status: r.status, detail }, 502);
  }
  const rid = await r.json().catch(() => ({}));
  return json({ ok: true, enviado: true, para, assunto: tpl.subject, link, resend_id: rid.id || null });
}
