// lazyRetry — o mesmo carregador resiliente do App.jsx, agora disponível para as telas da Central.
//
// POR QUE AS TELAS PRECISAM DELE (2026-09-28): as ~66 telas da Central usavam `lazy()` puro. Aba
// aberta durante um deploy + cliente abre uma tela ainda não carregada = o pedaço antigo já não
// existe no servidor (404). O React GUARDA a rejeição: a tela fica morta até recarregar, e o que
// o cliente via era a Central inteira trocada pela página de erro. Aqui o import tenta de novo
// com espera crescente e, se a janela de propagação não fechar, recarrega no máximo 4× em 2 min.
import { lazy } from "react";

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export function lazyRetry(factory, retries = 4, baseDelay = 400) {
  return lazy(async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try { return await factory(); }
      catch (err) {
        if (attempt === retries) {
          try {
            const key = "guileo_chunk_reload";
            const prev = JSON.parse(sessionStorage.getItem(key) || '{"n":0,"t":0}');
            const now = Date.now();
            const n = (now - prev.t < 120000) ? prev.n : 0;
            if (n < 4) {
              sessionStorage.setItem(key, JSON.stringify({ n: n + 1, t: now }));
              await dormir(1500);
              window.location.reload();
              return await new Promise(() => {});
            }
          } catch { /* sessionStorage bloqueado → cai no erro real */ }
          throw err;
        }
        await dormir(baseDelay * Math.pow(2, attempt));
      }
    }
  });
}
