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
import { json, rateLimited } from "../lib/guard.js";

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
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

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
    const d = await r.json().catch(() => ({}));

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
