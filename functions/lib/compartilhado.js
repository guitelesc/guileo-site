// functions/lib/compartilhado.js — O QUE A PESSOA COMPARTILHOU NO DIRECT (pura, sem rede).
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE (2026-09-10, medido no Chigo)
// Em 02/09 alguém mandou 4 reels/posts no direct do @chigotravels e escreveu "Low tick". As 4
// vezes a Gui respondeu "não consigo abrir esse arquivo — me escreve o que você precisa?".
// É exatamente assim que se pergunta preço no Instagram: compartilha o post da viagem e manda
// "quanto custa isso?". O momento de maior intenção virava um pedido de texto.
//
// DOIS DEFEITOS, um escondendo o outro:
//   1. anexo compartilhado sem texto → recado genérico, a pergunta nunca chegava ao cérebro;
//   2. anexo compartilhado COM texto ("quanto custa isso?" + reel) → o anexo era IGNORADO por
//      inteiro, porque o código só olhava anexo quando o texto vinha vazio. Esse é o caso comum.
//
// O QUE A META GARANTE, E O QUE NÃO GARANTE
// A documentação oficial só promete `payload.url`. A nota da Meta sobre `ig_reel` (e a issue
// restfb #1439) diz que o reel traz também `title`, `url` e o id do vídeo — mas nenhuma das duas
// mostra o JSON, e nada confirma que `title` seja a legenda. Por isso: lemos `title`/`caption`
// SE vierem, nunca inventamos quando não vêm, e `resumoAnexos` grava o formato REAL no evento.
// O primeiro reel de verdade que chegar diz se o palpite estava certo — janela antes da correção.
//
// SEGURANÇA: a legenda é conteúdo de TERCEIRO (qualquer um escreve legenda). Ela entra só como
// conteúdo do usuário, entre aspas, cortada em 400 caracteres — nunca no prompt de sistema.
// ═════════════════════════════════════════════════════════════════════════════════════════════

// Tipos que a Meta usa para conteúdo compartilhado. `share` é o legado de post (descontinuado em
// fev/2026, mas ainda chega de contas antigas). `story_mention` fica DE FORA de propósito: é
// alguém marcando o negócio no próprio story — outro assunto, não "me fala desse post".
const TIPOS = {
  ig_reel: "reel", reel: "reel",
  ig_post: "post", share: "post",
  ig_story: "story", story: "story",
};

const limpar = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, 400);

/** O primeiro anexo compartilhado da mensagem → { tipo, legenda, temUrl }, ou null. */
export function lerCompartilhado(anexos) {
  for (const a of Array.isArray(anexos) ? anexos : []) {
    const tipo = a && TIPOS[String(a.type || "").toLowerCase()];
    if (!tipo) continue;
    const p = (a.payload && typeof a.payload === "object") ? a.payload : {};
    return { tipo, legenda: limpar(p.title ?? p.caption ?? ""), temUrl: !!p.url };
  }
  return null;
}

/**
 * O texto que vai ao cérebro. A nota é FACTUAL, sem ordem dentro ("pergunte X" seria instrução
 * escondida em conteúdo de usuário — exatamente o que a constituição manda ignorar). Em inglês
 * porque o prompt de sistema é em inglês; a Gui espelha o idioma de quem escreveu.
 * Aspas duplas da legenda viram simples: senão uma legenda poderia "fechar" a citação.
 */
export function juntarCompartilhado(texto, c) {
  const t = String(texto == null ? "" : texto).trim();
  if (!c) return t;
  const nome = { reel: "an Instagram reel", post: "an Instagram post", story: "an Instagram story" }[c.tipo] || "an Instagram post";
  const nota = c.legenda
    ? `[the customer shared ${nome} — its caption: "${c.legenda.replace(/"/g, "'")}"]`
    : `[the customer shared ${nome}; its caption is not available]`;
  return t ? `${t}\n\n${nota}` : nota;
}

/**
 * A JANELA: o formato real do anexo, pra quem for investigar. Guarda os NOMES dos campos, o
 * título, os ids e só o HOST da url — url de CDN assinada é longa, expira e não serve pra nada
 * guardada inteira. Até 10/09 o evento guardava só {from, channel}, e por isso ninguém sabia o que
 * a Meta manda num reel.
 */
export function resumoAnexos(anexos) {
  return (Array.isArray(anexos) ? anexos : []).slice(0, 4).map((a) => {
    const p = (a && a.payload && typeof a.payload === "object") ? a.payload : {};
    const out = { tipo: String((a && a.type) || ""), campos: Object.keys(p).slice(0, 12) };
    if (p.title != null) out.title = limpar(p.title).slice(0, 160);
    for (const k of Object.keys(p)) if (/(^id$|_id$)/.test(k)) out[k] = String(p[k]).slice(0, 40);
    if (p.url) { try { out.url_host = new URL(String(p.url)).host; } catch { out.url_host = "invalida"; } }
    return out;
  });
}
