// tetoDeRede — nenhuma chamada da Central espera para sempre.
//
// POR QUE EXISTE (2026-09-28): havia ZERO timeouts em 21 chamadas do portalApi e 45 telas. Em
// sinal fraco de celular a tela "Hoje" ficava em quatro caixas pulsando, sem botão de tentar de
// novo, para sempre — porque um fetch que não responde não falha, só não termina, e o estado de
// "carregando" nunca era desligado.
//
// Em vez de editar 66 arquivos (e esquecer o 67º que alguém escrever amanhã), o teto entra UMA
// vez, na porta: toda chamada para /api/** e para as RPCs do banco que NÃO trouxer um sinal
// próprio ganha um. Quem já passa `signal` manda no próprio relógio. 45s é folga para as rotas
// que geram texto com modelo; o objetivo não é apressar ninguém, é garantir que TERMINA.
const TETO_MS = 45000;

export function instalarTetoDeRede(ms = TETO_MS) {
  if (typeof window === "undefined" || window.__guileoTetoDeRede) return;
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") return; // navegador antigo: fica como era
  window.__guileoTetoDeRede = true;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const url = typeof input === "string" ? input : ((input && input.url) || "");
      const nosso = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`) || url.includes("/rest/v1/rpc/");
      const jaTemSinal = !!(init && init.signal);
      if (nosso && !jaTemSinal) init = { ...(init || {}), signal: AbortSignal.timeout(ms) };
    } catch { /* qualquer dúvida → chamada original, intacta */ }
    return original(input, init);
  };
}
