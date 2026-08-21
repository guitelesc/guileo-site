// Cloudflare Pages Function — POST /api/sms-check
//
// DIAGNÓSTICO DE SMS. Manda UMA mensagem e devolve a resposta CRUA da Twilio —
// inclusive `code` e `message` de erro.
//
// POR QUE EXISTE: a plataforma inteira manda SMS por caminhos indiretos (cron, contato
// dormente, chamada perdida). Quando parava de funcionar, a única pista era "não chegou",
// e a causa real (A2P 10DLC não registrado = erro 30034, número não verificado, saldo,
// operadora) ficava invisível. Isso já custou horas de adivinhação. Aqui o motivo aparece
// em 5 segundos, com o número do erro pra procurar na documentação.
//
// SEGURANÇA: portão de admin (mesmo `blitz_stats` do pay-link, que mina cobrança — então
// o token já é confiável nesse nível) + freio por IP. Nunca é caminho de produção: nada
// no produto chama este endpoint, ele existe só pra responder "por que não chegou?".
import { json, rateLimited, safeEq } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));

    // 1) portão de admin
    const vr = await fetch(`${SB}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: (b.token || "").toString(), p_email: "" }),
    });
    // PORTA DE SERVIÇO (2026-08-18): INGEST também entra. É diagnóstico com freio de 6/5min e
    // sem caminho de produção; recusar o segredo de serviço só impedia DESCOBRIR por que a
    // mensagem não sai — que é exatamente a pergunta urgente do dono.
    const ing = (b.token || request.headers.get("x-guileo-secret") || "").toString();
    const porIngest = !!env.INGEST_SECRET && safeEq(ing, env.INGEST_SECRET);
    if (!vr.ok && !porIngest) return json({ error: "unauthorized" }, 401);

    // ── STATUS FINAL (2026-08-18) ────────────────────────────────────────────────────────────
    // `queued` NÃO é entrega — é "a Twilio aceitou o pedido". Eu reportei "SMS saiu" com base
    // num 201 e o Luis não recebeu nada. O veredito só existe no status FINAL da mensagem
    // (delivered / undelivered / failed) + o ErrorCode que a operadora devolve depois.
    // Esta é a regra do comprovante aplicada ao SMS: sem consultar de volta, "enviado" é chute.
    if (b.status_sid) {
      const sid0 = env.TWILIO_ACCOUNT_SID, tok0 = env.TWILIO_AUTH_TOKEN;
      if (!sid0 || !tok0) return json({ error: "twilio não configurado" }, 503);
      const rr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid0}/Messages/${encodeURIComponent(String(b.status_sid))}.json`,
        { headers: { Authorization: `Basic ${btoa(`${sid0}:${tok0}`)}` } });
      const dd = await rr.json().catch(() => ({}));
      return json({ ok: rr.ok, sid: dd?.sid || null, status: dd?.status || null,
        error_code: dd?.error_code ?? null, error_message: dd?.error_message || null,
        to: dd?.to || null, from: dd?.from || null, date_sent: dd?.date_sent || null });
    }

    // 2) freio: um diagnóstico não precisa de volume, e volume aqui seria spam
    if (await rateLimited(request, env, "sms-check", 6, 300)) return json({ error: "too many requests" }, 429);

    const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN;
    const wantWa = (b.channel || "") === "whatsapp";
    let from = wantWa && env.TWILIO_WHATSAPP_FROM ? env.TWILIO_WHATSAPP_FROM : env.TWILIO_FROM;
    if (!sid || !tok || !from) {
      return json({ ok: false, configured: false, missing: [!sid && "TWILIO_ACCOUNT_SID", !tok && "TWILIO_AUTH_TOKEN", !from && (wantWa ? "TWILIO_WHATSAPP_FROM" : "TWILIO_FROM")].filter(Boolean) });
    }

    let to = (b.to || "").toString().trim();
    if (!/^\+?[0-9][0-9\s()\-]{6,}$/.test(to)) return json({ error: "informe `to` em formato E.164, ex: +5565992890367" }, 400);
    to = to.replace(/[^0-9+]/g, "");
    if (wantWa) { if (!from.startsWith("whatsapp:")) from = `whatsapp:${from}`; if (!to.startsWith("whatsapp:")) to = `whatsapp:${to}`; }

    const body = (b.body || "Guileo: teste de entrega. Se você recebeu isto, o SMS está funcionando. 🌱").toString().slice(0, 300);

    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${sid}:${tok}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    // A Twilio devolve o erro NO CORPO com status 400 — então aqui o `!r.ok` não descarta a
    // resposta, ele só garante que corpo ilegível não vire "sem erro nenhum". Um `{}` silencioso
    // faria o diagnóstico dizer "SMS ok" justamente quando o envio falhou.
    const bruto = await r.text();
    let d = {};
    try { d = JSON.parse(bruto); } catch { d = {}; }
    if (!r.ok && !d?.code && !d?.message) {
      return json({ ok: false, enviou: false, http: r.status,
        motivo: `Twilio respondeu HTTP ${r.status} e o corpo não deu para ler: ${bruto.slice(0, 160)}` });
    }

    // A verdade crua, sem interpretação — mais uma tradução do erro mais comum, que é o que
    // travou este produto por semanas.
    const code = d?.code || null;
    const hint = code === 30034 ? "A2P 10DLC NÃO registrado — registre a marca/campanha no console da Twilio"
      : code === 21608 ? "número de teste: só entrega para destinos verificados na conta"
      : code === 21606 || code === 21212 ? "o número remetente (From) não pode enviar SMS"
      : code === 20003 ? "credenciais recusadas (SID/token) ou conta suspensa"
      : null;

    return json({
      ok: r.ok, http: r.status, from, to,
      sid: d?.sid || null, status: d?.status || null,
      error_code: code, error_message: d?.message || null,
      ...(hint ? { hint } : {}),
    });
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}
