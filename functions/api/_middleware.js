// ── ANTHROPIC DESLIGADA (2026-10-05, Luis: «você não pode usar IA Anthropic… pode usar agentes normais,
// sem API, o nosso daqui»). Interruptor ÚNICO para TODA rota /api/*: sem ANTHROPIC_LIGADA=1 no Cloudflare, a
// chave fica invisível para o código — cada rota cai no caminho que já tinha para "sem chave" (o agente da
// ElevenLabs do cliente, ou a frase honesta). Religar é uma variável no Cloudflare, sem deploy de código.
//
// Por que AQUI e não no functions/_middleware.js: aquele roteia o domínio do cliente e tem uma lei testada
// (dominio.test.mjs §7a) — no host nosso ele não lê env nenhuma, é o `legado` e mais nada. Esta porta só vê
// /api/*, que é onde a Anthropic era chamada.
//
// Antes de desligar, os 3 canais de cliente que paravam ao NÃO ver a chave (widget-chat, gui-chat, guiReply)
// passaram a exigir "nenhum cérebro" para desistir — senão ficariam mudos com a ElevenLabs de pé.
import { instalarTrava } from "../lib/travaEmail.js";

export function desligaAnthropic(env) {
  if (!env || String(env.ANTHROPIC_LIGADA || "") === "1") return false;
  try { env.ANTHROPIC_API_KEY = ""; return true; } catch { return false; }
}

export async function onRequest(context) {
  desligaAnthropic(context.env);
  // E-mail para o Gmail do Luis barrado na saída (pedido dele, 12/10). Ver lib/travaEmail.js.
  instalarTrava(context.env);
  return context.next();
}
