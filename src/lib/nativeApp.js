// Guileo Desk, the native iOS app (apps/desk-ios), adds "GuileoDeskApp/<versão>" ao user agent.
// É por aqui que o site sabe que está dentro do app, e esconde o que a Apple não aceita lá:
// criar conta sem poder apagar (5.1.1), "Instalar o app", assinatura/upgrade fora da loja (3.1.1)
// e pixels de anúncio (5.1.2). Fora do app nada muda.
export const NO_APP_NATIVO = typeof navigator !== "undefined" && /GuileoDeskApp\//.test(navigator.userAgent || "");
