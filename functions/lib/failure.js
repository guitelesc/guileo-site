// functions/lib/failure.js — structured failure-event bus.
// Turns every silent catch / unchecked critical step into a VISIBLE event in /admin, so a "paid-but-
// nothing" or "revenue lost" failure is caught in seconds instead of via a customer's money-back request.
// Writes to the platform feed (admin_all_events reads it) under the OWNER email, with the affected client
// named in the summary. Uses the existing ingest_client_event RPC → no new table/SQL required.
import { svcJson } from "./sb.js";
import { avisarDono } from "./avisarDono.js";

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

// Alarme urgente ao dono. NUNCA lança (o chamador é sempre um catch de emergência).
// (2026-09-09) Era uma cópia local de "manda e-mail" com trava `alarme_uma_vez` — que hoje só o
// service_role executa (anon revogado), então sem SUPABASE_SERVICE_ROLE a trava era ilegível em
// TODA chamada. Virou `avisarDono`: feed + e-mail (caixa que o dono lê) + WhatsApp, trava de 6h por
// (tipo + cliente) via health_claim, e a regra do "não sei" preservada — só o `false` explícito cala.
// O feed que este arquivo grava logo abaixo continua: é a linha de auditoria com `failure_type`.
// (2026-09-27) DEVOLVE o recibo do avisarDono — antes era `await avisarDono(...)` sem `return`, e
// o comprovante de que o alarme saiu (ou não) morria aqui dentro.
async function emailUrgente(env, type, affectedEmail, detail, opts = {}) {
  return avisarDono(env, {
    kind: `falha_${(type || "").toString().slice(0, 50)}`, summary: (detail || type || "").toString(),
    cliente: affectedEmail || "", chave: `falha:${(type || "").toString().slice(0, 40)}:${(affectedEmail || "-").toString().slice(0, 40)}`,
    semTrava: opts.semTrava === true, ignoraMudo: opts.ignoraMudo === true,
  });
}

// emitFailure(env, type, affectedEmail, detail, payload?, opts?) — never throws, never blocks the caller.
//
// 🧾 DEVOLVE UM RECIBO (2026-09-27): { urgente, feed, email, whatsapp, chegou }.
// Antes devolvia `undefined`: o chamador escrevia "escalei para um humano" sem ter como saber se
// o aviso saiu por ALGUM canal. Com e-mail mudo + WhatsApp fora, o chamado urgente caía só no feed
// e ninguém — nem o código — sabia disso. Quem ignora o retorno continua funcionando igual.
//   · feed     — a linha de auditoria `failure` que ESTE arquivo grava ({ ok, id? | motivo }).
//   · email / whatsapp — o que o avisarDono respondeu por canal; em tipo não urgente, dizem isso.
//   · chegou   — true só se e-mail OU WhatsApp confirmaram (feed sozinho não acorda ninguém).
// opts: { semTrava, ignoraMudo } — repassados ao avisarDono (ver lá o porquê e os limites).
export async function emitFailure(env, type, affectedEmail, detail, payload = {}, opts = {}) {
  const urgente = ehUrgente(type);
  const soFeed = { ok: false, motivo: "tipo não urgente — fica só no feed" };
  const recibo = {
    urgente, chegou: false,
    feed: { ok: false, motivo: "não tentado" },
    email: urgente ? { ok: false, motivo: "não tentado" } : soFeed,
    whatsapp: urgente ? { ok: false, motivo: "não tentado" } : soFeed,
  };
  try {
    // structured log line (surfaces in Cloudflare logs even if the DB write fails)
    try { console.error(JSON.stringify({ failure: type, client: affectedEmail || "", detail: (detail || "").toString().slice(0, 300) })); } catch { /* */ }
    // O E-MAIL VEM ANTES DO FEED, e de propósito: se o banco estiver fora (que é justamente quando
    // as falhas urgentes acontecem em série), o `ingest_client_event` abaixo falha — e o alarme que
    // dependesse dele para sair nunca sairia. Cada um com seu try: um não derruba o outro.
    if (urgente) {
      try {
        const a = (await emailUrgente(env, type, affectedEmail, detail, opts || {})) || {};
        if (a.pulado) {
          // A trava de 6h calou: isso NÃO é "enviado". O recibo diz que foi pulado e por quê.
          recibo.email = { ok: false, pulado: true, motivo: a.pulado };
          recibo.whatsapp = { ok: false, pulado: true, motivo: a.pulado };
        } else if (a.erro) {
          recibo.email = { ok: false, motivo: a.erro };
          recibo.whatsapp = { ok: false, motivo: a.erro };
        } else {
          recibo.email = a.email || { ok: false, motivo: "avisarDono não devolveu o canal de e-mail" };
          recibo.whatsapp = a.whatsapp || { ok: false, motivo: "avisarDono não devolveu o canal de WhatsApp" };
        }
        recibo.chegou = !!(recibo.email.ok || recibo.whatsapp.ok);
      } catch (e) {
        const motivo = String(e).slice(0, 120);
        recibo.email = { ok: false, motivo }; recibo.whatsapp = { ok: false, motivo };
        try { console.error(JSON.stringify({ alarme_email: type, erro: motivo })); } catch { /* */ }
      }
    }
    if (!env.INGEST_SECRET) { recibo.feed = { ok: false, motivo: "sem INGEST_SECRET" }; return recibo; }
    const owner = (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim().toLowerCase();
    // O recibo do aviso vai DENTRO da linha de auditoria: quem abrir o /admin vê o chamado E se o
    // alarme saiu da plataforma. `svcJson` (não `svcRpc`) porque HTTP 200 não prova que gravou.
    const r = await svcJson(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET, p_email: owner, p_type: "failure", p_channel: "system",
      p_summary: `⚠️ ${type}${affectedEmail ? " · " + affectedEmail : ""}${detail ? " · " + detail : ""}`.slice(0, 300),
      p_amount: 0, p_payload: {
        failure_type: type, client: affectedEmail || "", ...payload,
        ...(urgente ? { aviso: {
          chegou: recibo.chegou,
          email: { ok: !!recibo.email.ok, id: recibo.email.id || null, motivo: recibo.email.motivo || "" },
          whatsapp: { ok: !!recibo.whatsapp.ok, via: recibo.whatsapp.via || "", motivo: (recibo.whatsapp.motivo || "").toString().slice(0, 300) },
        } } : {}),
      },
    });
    recibo.feed = (r && typeof r === "object" && r.ok === false)
      ? { ok: false, motivo: `http ${r.erro_http || "?"} ${r.detalhe || ""}`.trim() }
      : { ok: true, id: (r && typeof r !== "object") ? r : (r && r.id) || null };
  } catch (e) {
    /* failure-bus is itself best-effort — never break the caller */
    try { if (!recibo.feed.ok) recibo.feed = { ok: false, motivo: String(e).slice(0, 120) }; } catch { /* */ }
  }
  return recibo;
}
