// GET /api/saldo-twilio · x-guileo-secret: INGEST — o saldo e o estado da conta Twilio, e mais nada.
// POR QUE EXISTE (2026-09-30): o vigia (health-monitor) só ESCREVE quando o saldo está baixo, com
// trava de 6h. Depois de uma recarga não havia como confirmar "entrou" sem esperar a próxima janela
// ou abrir o console. Conta suspensa por saldo já derrubou o telefone de todos os clientes uma vez;
// "recarreguei" precisa de comprovante na hora. Só número e estado — nenhuma credencial sai daqui.
import { json, safeEq } from "../lib/guard.js";

export async function onRequestGet({ request, env }) {
  if (!env.INGEST_SECRET || !safeEq(request.headers.get("x-guileo-secret") || "", env.INGEST_SECRET)) return json({ error: "unauthorized" }, 401);
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return json({ ok: false, motivo: "sem credencial da Twilio no ambiente" }, 503);
  const auth = `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`;
  const base = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}`;
  try {
    const [br, ar] = await Promise.all([
      fetch(`${base}/Balance.json`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(8000) }),
      fetch(`${base}.json`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(8000) }),
    ]);
    const b = await br.json().catch(() => ({}));
    const a = await ar.json().catch(() => ({}));
    const saldo = Number(b.balance);
    if (!br.ok || !Number.isFinite(saldo)) return json({ ok: false, motivo: `a Twilio respondeu HTTP ${br.status} ao saldo` }, 503);
    const piso = Number(env.TWILIO_BALANCE_FLOOR_USD) || 20;
    return json({ ok: true, saldo_usd: Math.round(saldo * 100) / 100, moeda: b.currency || "USD", piso_usd: piso, acima_do_piso: saldo >= piso,
      conta: ar.ok ? { estado: a.status || null, tipo: a.type || null } : { estado: null, motivo: `HTTP ${ar.status}` }, lido_em: new Date().toISOString() });
  } catch (e) {
    return json({ ok: false, motivo: `não consegui falar com a Twilio: ${String(e).slice(0, 80)}` }, 503);
  }
}
