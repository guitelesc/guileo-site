// ACESSO NOMINAL DE PARCEIRO (CR-03, 2026-10-13) — as partes puras, testáveis sem rede.
// O código de 6 dígitos nunca vai ao banco: só o SHA-256 de "email:otp". A chave do cliente
// só sai do servidor depois do OTP conferido, e nunca aparece no e-mail.

export const OTP_OK = /^\d{6}$/;

export function gerarOtp() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, "0");
}

export async function hashOtp(email, otp) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${String(email).trim().toLowerCase()}:${String(otp).trim()}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// senha inicial do usuário Supabase (o admin entrega pessoa a pessoa; o parceiro troca no primeiro acesso)
export function senhaInicial() {
  const alfa = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((n) => alfa[n % alfa.length]).join("");
}
