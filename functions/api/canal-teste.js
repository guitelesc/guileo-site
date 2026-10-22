// POST /api/canal-teste · x-guileo-secret: INGEST — prova o caminho de MENSAGEM sem depender da Meta/Twilio.
// Roda o MESMO `handleInboundMessage` que os webhooks do WhatsApp, Instagram, Messenger e SMS chamam
// (memória da conversa, reconhecimento pelo nome, cérebro, CRM, caixa de entrada) — só não ENVIA
// nada: a resposta volta no JSON. Os webhooks de verdade exigem a assinatura da Meta/Twilio, que
// não dá para produzir de fora; esta rota existe para provar o resto antes de a aprovação sair.
//
// SÓ NA CONTA DE TESTE. A lista é fixa no código: nenhuma mensagem de prova pode cair na caixa de
// entrada de um cliente de verdade, nem com o segredo certo.
//   { channel: "whatsapp"|"sms"|"instagram"|"messenger", from, text, name?, lang? }
import { json, safeEq } from "../lib/guard.js";
import { handleInboundMessage } from "../lib/messageAdapter.js";

const CONTA_DE_TESTE = "e2e-test@guileoai.com";
const CANAIS = new Set(["whatsapp", "sms", "instagram", "messenger"]);

export async function onRequestPost({ request, env }) {
  if (!env.INGEST_SECRET || !safeEq(request.headers.get("x-guileo-secret") || "", env.INGEST_SECRET)) return json({ error: "unauthorized" }, 401);
  const b = await request.json().catch(() => ({}));
  const channel = String(b.channel || "").toLowerCase();
  if (!CANAIS.has(channel)) return json({ error: "channel must be whatsapp | sms | instagram | messenger" }, 400);
  const from = String(b.from || "").slice(0, 60);
  const text = String(b.text || "").slice(0, 600);
  if (!from || !text) return json({ error: "from + text required" }, 400);
  const r = await handleInboundMessage(env, { channel, tenantEmail: CONTA_DE_TESTE, from, text, name: String(b.name || "").slice(0, 60), lang: String(b.lang || "en").slice(0, 2), origin: new URL(request.url).origin });
  return json({ ok: true, conta: CONTA_DE_TESTE, channel, ready: !!r.ready, escalate: !!r.escalate, duplicate: !!r.duplicate, reply: r.reply || "" });
}
