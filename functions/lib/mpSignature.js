// Verificação da assinatura do Mercado Pago — UMA implementação, dois webhooks.
//
// POR QUE VIVE AQUI: o /api/mercadopago-webhook verificava a assinatura (com janela
// anti-replay de 10 min) e o /api/pix-webhook — que também move DINHEIRO — não verificava
// nada. Dois webhooks de pagamento com dois padrões de segurança é como a divergência
// começa: alguém endurece um e esquece o outro. Agora é o mesmo código nos dois.
//
// O que isso impede: qualquer um que descubra a URL do webhook forjar um "pagamento
// aprovado". Sem assinatura, o servidor acredita em quem bater na porta.
import { safeEq } from "./guard.js";

export async function verifyMpSignature(sigHeader, requestId, dataId, secret) {
  try {
    if (!secret) return false; // sem segredo configurado não há como afirmar nada
    const parts = Object.fromEntries((sigHeader || "").split(",").map((p) => p.split("=").map((s) => (s || "").trim())));
    const ts = parts.ts, v1 = parts.v1;
    if (!ts || !v1) return false;
    // Janela de 10 min: o MP atrasa mais que o Stripe em confirmação assíncrona de PIX.
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 600) return false;
    const id = /[a-z]/i.test(dataId) ? String(dataId).toLowerCase() : dataId;
    let manifest = "";
    if (id) manifest += `id:${id};`;
    if (requestId) manifest += `request-id:${requestId};`;
    manifest += `ts:${ts};`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return safeEq(hex, v1);
  } catch { return false; }
}
