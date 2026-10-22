// Cloudflare Pages Function — GET/POST /api/tiktok · canal TikTok (2026-10-13) — SCAFFOLD INERTE E HONESTO.
// Promessa "planejada" do Natura (Anexo A, Parte 4): responder mensagens, captar leads e agendar no TikTok.
// A API de mensagens de negócio do TikTok (Business Messaging) é liberada PELO TIKTOK, por aplicativo e por
// conta — e esse pedido ainda não foi feito (depende de conta TikTok for Business do Luis). Padrão nº 4 do
// ARQUITETURA.md, como mindbody.js nasceu: {ready:false, note} até env + credenciais existirem. Nada aqui
// finge; a Central lê `ready` e diz "depende do TikTok". Quando a liberação sair: credenciais em
// TIKTOK_APP_ID / TIKTOK_APP_SECRET, webhook de mensagens → o mesmo cérebro do chat (ROTA-MOTOR).
import { json } from "../lib/guard.js";

export async function onRequestPost({ env }) {
  const temChave = !!(env.TIKTOK_APP_ID && env.TIKTOK_APP_SECRET);
  return json({
    ok: true, ready: false, estado: temChave ? "pending" : "planned",
    note: temChave
      ? "credenciais presentes; a liberação do TikTok para mensagens de negócio ainda não existe — nada ligado"
      : "depende da liberação do TikTok (Business Messaging), ainda não pedida — nada ligado",
    vars: ["TIKTOK_APP_ID", "TIKTOK_APP_SECRET"],
  });
}
export const onRequestGet = onRequestPost;
