// functions/lib/failure.js — structured failure-event bus.
// Turns every silent catch / unchecked critical step into a VISIBLE event in /admin, so a "paid-but-
// nothing" or "revenue lost" failure is caught in seconds instead of via a customer's money-back request.
// Writes to the platform feed (admin_all_events reads it) under the OWNER email, with the affected client
// named in the summary. Uses the existing ingest_client_event RPC → no new table/SQL required.
import { svcRpc, svcJson } from "./sb.js";
import { opsAlertEmail } from "./emailTemplates.js";

// ── OS TIPOS QUE ACORDAM ALGUÉM (2026-08-25) ────────────────────────────────────────────────────
// A lei já estava escrita em cron-tick.js: «alarme que fica dentro da plataforma é alarme que não
// existe». O feed do /admin resolve a AUDITORIA (o que aconteceu, em ordem), não o SOCORRO: ninguém
// abre o /admin às 2h da manhã. Estes tipos são os que custam cliente ou dinheiro na hora em que
// acontecem, então também SAEM por e-mail:
//   · provision*  → cliente pagou e o agente/número não nasceu (o pior de todos: pagou e não tem produto)
//   · escalad/escalate → um humano foi chamado por um cliente e ninguém sabe disso fora do feed
//   · credit/credito_zerado → o Gui parou de trabalhar por falta de crédito
//   · number      → linha sem número / número sem agente: o telefone simplesmente não toca
// O resto continua só no feed, de propósito: e-mail de tudo vira ruído, e ruído é como um alarme
// morre no dia em que importa.
const URGENTES = ["provision", "escalad", "escalate", "credito_zerado", "credit", "number"];
const ehUrgente = (type) => {
  const t = (type || "").toString().toLowerCase();
  return URGENTES.some((k) => t.includes(k));
};

// E-mail best-effort do alarme urgente. NUNCA lança (o chamador é sempre um catch de emergência).
// Mesmo mecanismo de envio do health-monitor.js: POST direto na Resend com env.RESEND_API_KEY.
async function emailUrgente(env, type, affectedEmail, detail) {
  if (!env.RESEND_API_KEY) return; // sem mailer: o feed já registrou; não há o que fazer aqui
  // ANTI-SPAM: no máximo 1 e-mail por (tipo + cliente) a cada 6h, via a MESMA trava genérica que o
  // cron já usa em produção (`alarme_uma_vez`, chave livre + minutos).
  // ⚠️ A REGRA DO "NÃO SEI": só o `false` explícito ("já avisei") cala o e-mail. Se a trava não
  // puder ser consultada (RPC ausente, banco fora, segredo faltando → svcJson devolve um OBJETO de
  // erro, nem true nem false), o e-mail SAI. Um alarme duplicado é chato; um alarme mudo por causa
  // do próprio anti-spam é exatamente a falha silenciosa que esta biblioteca existe para acabar.
  let pode = true;
  if (env.INGEST_SECRET) {
    const r = await svcJson(env, "alarme_uma_vez", {
      p_secret: env.INGEST_SECRET,
      p_chave: `falha:${(type || "").toString().slice(0, 60)}:${(affectedEmail || "-").toString().slice(0, 80)}`,
      p_minutos: 360,
    }).catch(() => null);
    if (r === false) pode = false;
  }
  if (!pode) return;
  const { subject, html } = opsAlertEmail({ type, client: affectedEmail, detail });
  const to = (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim();
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }),
  });
  // Conferir o retorno: "enviado" sem olhar a resposta da Resend é a promessa sem lastro de sempre.
  if (!r.ok) console.error(JSON.stringify({ alarme_email: type, resend: r.status }));
}

// emitFailure(env, type, affectedEmail, detail, payload?) — never throws, never blocks the caller.
export async function emitFailure(env, type, affectedEmail, detail, payload = {}) {
  try {
    // structured log line (surfaces in Cloudflare logs even if the DB write fails)
    try { console.error(JSON.stringify({ failure: type, client: affectedEmail || "", detail: (detail || "").toString().slice(0, 300) })); } catch { /* */ }
    // O E-MAIL VEM ANTES DO FEED, e de propósito: se o banco estiver fora (que é justamente quando
    // as falhas urgentes acontecem em série), o `ingest_client_event` abaixo falha — e o alarme que
    // dependesse dele para sair nunca sairia. Cada um com seu try: um não derruba o outro.
    if (ehUrgente(type)) {
      try { await emailUrgente(env, type, affectedEmail, detail); }
      catch (e) { try { console.error(JSON.stringify({ alarme_email: type, erro: String(e).slice(0, 120) })); } catch { /* */ } }
    }
    if (!env.INGEST_SECRET) return;
    const owner = (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim().toLowerCase();
    await svcRpc(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET, p_email: owner, p_type: "failure", p_channel: "system",
      p_summary: `⚠️ ${type}${affectedEmail ? " · " + affectedEmail : ""}${detail ? " · " + detail : ""}`.slice(0, 300),
      p_amount: 0, p_payload: { failure_type: type, client: affectedEmail || "", ...payload },
    });
  } catch { /* failure-bus is itself best-effort — never break the caller */ }
}
