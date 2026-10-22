// GET /api/aviso-teste  · header x-guileo-secret: <INGEST_SECRET>
// Dispara UM avisarDono de verdade (feed + e-mail + WhatsApp) e devolve o RECIBO por canal.
// Existe porque o canal do dono só era exercitado por incidente real — e um canal que só se
// prova quando algo quebra é um canal que se descobre morto na pior hora (2026-09-10: o
// WhatsApp do dono nunca tinha sido cadastrado e ninguém sabia). Aqui o teste é barato e diz,
// por canal, se chegou e por que não. Trava: o mesmo segredo do ingest, comparado à env —
// nunca um status HTTP (lei "status não é autenticação").
import { json, safeEq } from "../lib/guard.js";
import { avisarDono } from "../lib/avisarDono.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const s = request.headers.get("x-guileo-secret") || "";
  if (!env.INGEST_SECRET || !safeEq(s, env.INGEST_SECRET)) return json({ error: "unauthorized" }, 401);
  const quando = new Date().toISOString().slice(0, 16).replace("T", " ");
  const recibo = await avisarDono(env, {
    kind: "teste_canal",
    summary: `🧪 Teste do canal do dono (${quando} UTC) — se você leu isto, o alerta chega.`,
    chave: `teste_canal:${Date.now()}`, // sem trava de 6h: teste é para repetir
    payload: { teste: true },
  });
  return json({ ok: true, recibo });
}
