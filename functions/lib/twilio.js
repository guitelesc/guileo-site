// functions/lib/twilio.js — minimal Twilio sender for the automations engine.
// FAIL-OPEN by design: when Twilio creds aren't set yet, callers get {sent:false}
// instead of a throw, so the engine can count "skipped" and retry on a later run
// (we deliberately don't mark bookings as reminded until a real send happens).
//
// BI-MARKET routing: pass opts.market ("BR"|"US") or opts.channel ("whatsapp"|"sms").
// BRAZIL → WhatsApp (env.TWILIO_WHATSAPP_FROM, the dominant channel there);
// US/default → SMS (env.TWILIO_FROM, A2P). If the WhatsApp sender isn't configured yet
// it falls back to TWILIO_FROM so nothing breaks before the sender is approved.
export async function sendText(env, to, body, opts = {}) {
  const sid = env.TWILIO_ACCOUNT_SID, token = env.TWILIO_AUTH_TOKEN;
  const wantWa = opts.channel === "whatsapp" || opts.market === "BR";
  let from = (wantWa && env.TWILIO_WHATSAPP_FROM) ? env.TWILIO_WHATSAPP_FROM : env.TWILIO_FROM;
  if (!sid || !token || !from) return { sent: false, reason: "not configured" };
  try {
    // WhatsApp senders need the whatsapp: prefix on BOTH sides; mirror From onto To.
    if (wantWa && env.TWILIO_WHATSAPP_FROM && !from.startsWith("whatsapp:")) from = `whatsapp:${from}`;
    let dest = String(to || "").trim();
    if (from.startsWith("whatsapp:") && !dest.startsWith("whatsapp:")) dest = `whatsapp:${dest}`;
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: dest, From: from, Body: body }),
    });
    return { sent: r.ok, status: r.status };
  } catch (e) {
    return { sent: false, reason: String(e).slice(0, 120) };
  }
}

// sendOrFlag — ENVIAR E SABER SE CHEGOU. Uma função, uma regra, todos os lugares.
//
// POR QUE EXISTE: em 2026-08-07 encontrei QUATRO chamadas `await sendText(...)` cujo retorno era
// jogado fora. `sendText` nunca lança: ele devolve {sent:false}. Então um envio recusado pela
// Twilio (hoje é o caso — campanha A2P reprovada) passava como se tivesse dado certo. O pior deles
// era o text-back de ligação perdida: a promessa principal do produto, falhando em silêncio e
// levando o lead junto.
//
// Corrigir os quatro na mão garante que o quinto nasça errado. Aqui a regra vive num lugar só:
// envia → confere → se falhou, o DONO fica sabendo, com motivo.
//
// `motivo` deve dizer o que a pessoa não recebeu, em linguagem de negócio — quem lê o alerta é o
// dono do salão, não um programador.
export async function sendOrFlag(env, { to, body, opts = {}, tenant = "", motivo = "mensagem" }) {
  let r = null;
  try { r = await sendText(env, to, body, opts); } catch (e) { r = { sent: false, reason: String(e).slice(0, 100) }; }
  if (r && r.sent) return r;
  try {
    const { emitFailure } = await import("./failure.js");
    await emitFailure(env, "mensagem_nao_entregue", tenant,
      `${motivo} NÃO chegou em ${to} — motivo: ${(r && (r.reason || `status ${r.status}`)) || "desconhecido"}`.slice(0, 200),
      { to, canal: opts.channel || "sms" });
  } catch { /* alertar é bônus; nunca derruba quem chamou */ }
  return r || { sent: false, reason: "unknown" };
}
