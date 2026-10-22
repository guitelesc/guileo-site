// LINK DE "ESQUECI A SENHA" QUE CAI NO LUGAR ERRADO (2026-10-01).
// O e-mail de recuperação volta com `#access_token=…&type=recovery`. Se o endereço de retorno não
// estiver na lista do Supabase, ele devolve a pessoa na página inicial — onde ninguém lê esse hash:
// ela vê o site, não o campo de senha nova, e conclui que "o link não é pra trocar".
// Este módulo é o PRIMEIRO import do main.jsx: antes de qualquer tela montar, leva a pessoa (com o
// hash intacto) para /portal, que é quem sabe abrir o campo de senha nova ou explicar link vencido.
try {
  const h = window.location.hash || "";
  const ehDeSenha = /(^|[#&])type=recovery(&|$)/.test(h) || /(^|[#&])error_code=otp_expired(&|$)/.test(h);
  if (ehDeSenha && !/^\/portal\/?$/.test(window.location.pathname)) {
    window.location.replace("/portal" + h);
  }
} catch { /* sem window (teste) → nada a fazer */ }
