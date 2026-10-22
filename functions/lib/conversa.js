// A CONVERSA CONTINUA — memória de curto prazo dos canais de mensagem (2026-09-30)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O chat do site manda o próprio histórico a cada mensagem (o navegador guarda). WhatsApp, SMS,
// Instagram e Messenger não têm navegador: cada mensagem chega sozinha, e o cérebro era chamado com
// `history: []`. Resultado medido no código: a pessoa escrevia "quero um facial", a agente
// perguntava "para que dia?", a pessoa respondia "quinta" — e "quinta" chegava sem nenhum contexto.
// Cada mensagem abria uma conversa nova.
//
// Aqui ficam as últimas trocas de cada (negócio, canal, pessoa), por 24 horas — a mesma janela que
// o WhatsApp dá para responder. Depois disso a conversa recomeça, e quem reconhece a pessoa é o CRM
// (identidadeChat.js), não este arquivo.
//
// ONDE MORA: no KV (env.RATE_LIMIT), o mesmo que já guarda dedup e limite de mensagens. Não é
// histórico de atendimento — esse é a caixa de entrada (client_events). É só o fio da conversa.
// SEM KV, tudo aqui vira no-op: a agente responde sem memória, como antes. Nunca lança.
//
// ISOLAMENTO: a chave começa pelo e-mail do negócio. O mesmo telefone falando com dois negócios
// tem duas conversas que não se enxergam.

const MAX_TURNOS = 8;          // 4 idas e vindas — o que o cérebro lê (guiReply usa os 6 últimos)
const MAX_TEXTO = 500;
const TTL = 24 * 60 * 60;      // segundos

// FNV-1a: a chave não carrega o telefone em claro, e cabe no limite de tamanho do KV.
function hash(str) {
  let h = 0x811c9dc5;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}

export function chaveDaConversa(tenant, channel, from) {
  const t = String(tenant || "").trim().toLowerCase();
  const c = String(channel || "").trim().toLowerCase();
  const f = String(from || "").trim().toLowerCase().replace(/^whatsapp:/, "");
  if (!t.includes("@") || !c || !f) return "";
  return `conv:${t}:${c}:${hash(f)}${hash(f.split("").reverse().join(""))}`;
}

// Só o que é turno de verdade: papel conhecido e texto. Corta o tamanho e a quantidade.
export function aparar(turnos) {
  return (Array.isArray(turnos) ? turnos : [])
    .filter((t) => t && (t.role === "user" || t.role === "gui") && typeof t.text === "string" && t.text.trim())
    .map((t) => ({ role: t.role, text: t.text.trim().slice(0, MAX_TEXTO) }))
    .slice(-MAX_TURNOS);
}

/** Os turnos anteriores desta pessoa neste canal. [] quando não há, ou quando o KV não responde. */
export async function lerConversa(env, tenant, channel, from) {
  const k = chaveDaConversa(tenant, channel, from);
  const kv = env && env.RATE_LIMIT;
  if (!k || !kv) return [];
  try { return aparar(JSON.parse((await kv.get(k)) || "[]")); } catch { return []; }
}

/** Acrescenta a mensagem da pessoa e a resposta da agente. Resposta vazia não é gravada. */
export async function gravarTroca(env, tenant, channel, from, { anteriores = [], pergunta = "", resposta = "" } = {}) {
  const k = chaveDaConversa(tenant, channel, from);
  const kv = env && env.RATE_LIMIT;
  if (!k || !kv) return false;
  const novos = aparar([...aparar(anteriores), { role: "user", text: String(pergunta || "") }, { role: "gui", text: String(resposta || "") }]);
  try { await kv.put(k, JSON.stringify(novos), { expirationTtl: TTL }); return true; } catch { return false; }
}
