// POST /api/gui-voz — link assinado para o "Gui · Central" (o assistente da dona dentro da Central).
//
// 2026-10-05 (Luis: «o agente ElevenLabs não faz pelos tools? sem eu usar Anthropic? o chat não tá
// funcional… a voz está horrível»). O Gui do canto direito era um interpretador de frases por
// palavra-chave (guiPlan) com a voz do navegador. Agora é um agente da ElevenLabs com FERRAMENTAS QUE
// RODAM NO NAVEGADOR (client tools): quem executa é a tela da dona, com a chave dela, nas mesmas rotas
// que ela já usa (/api/desk). O agente não tem acesso a nada que a dona não tenha.
//
// O agente é privado (auth ligada): sem este link assinado ninguém conversa com ele nem gasta os
// minutos da conta. Conta real = email + chave conferidos pela mesma porta do Desk (_desk_ok).
// Demonstração = sem chave, limite por IP (as ferramentas leem só dados de exemplo).
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { SB_URL, sbKey, svcJson } from "../lib/sb.js";
import { podeNoDesk } from "../lib/deskTrava.js";
import { ehCodigoDoBalcao, abrirComCodigo } from "../lib/deskAcesso.js";

const AGENTE = "agent_8901m4524v51ewmv4q8yejtn6bst"; // "Gui · Central (assistente da dona)" — Luis's Workspace
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

async function chaveConfere(email, key) {
  const agora = new Date();
  const r = await fetch(`${SB_URL}/rest/v1/rpc/desk_agenda`, {
    method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_email: email, p_key: key, p_from: agora.toISOString(), p_to: new Date(agora.getTime() + 60000).toISOString() }),
  }).catch(() => null);
  return !!(r && r.ok);
}

// A ASSISTENTE DO NEGÓCIO (2026-10-05, Luis: "no caso dela, Lilian"): o nome e a VOZ vêm do agente de
// telefone do próprio negócio (client_credits.agent_id → ElevenLabs). Uma voz só: a dona ouve na Central
// a mesma Lilian que as clientes ouvem no telefone. Sem agente → "Gui" com a voz padrão.
async function personaDo(env, email) {
  try {
    const k = sbKey(env);
    const r = await fetch(`${SB_URL}/rest/v1/client_credits?client_email=eq.${encodeURIComponent(email)}&select=agent_id&limit=1`, { headers: { apikey: k, Authorization: `Bearer ${k}` } });
    if (!r.ok) return null;                       // falha de leitura ≠ "sem agente": cai no "Gui" sem inventar
    const id = (await r.json().catch(() => null))?.[0]?.agent_id;
    if (!id || !/^agent_[a-z0-9]+$/i.test(id)) return null;
    const a = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${id}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
    if (!a.ok) return null;
    const j = await a.json().catch(() => null);
    const nome = String(j?.name || "").split(/[·|\-–—]/)[0].trim().slice(0, 30);
    const voz = j?.conversation_config?.tts?.voice_id || null;
    return nome ? { nome, voz } : null;
  } catch { return null; }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);
  let b = {}; try { b = await request.json(); } catch { /* corpo vazio = demonstração */ }
  const email = String(b.email || "").trim().toLowerCase();
  let key = String(b.key || "").trim();
  const demo = !(email.includes("@") && key);
  if (await rateLimited(request, env, demo ? "gui-voz-demo" : "gui-voz", demo ? 6 : 40, 3600, demo)) return json({ ok: false, error: "too_many" }, 429);
  // Recepção no /balcao (código "bal_…", lib/deskAcesso.js): a assistente abre; o que ela FAZ volta pelo /api/desk.
  if (!demo && ehCodigoDoBalcao(key)) {
    const p = await abrirComCodigo(env, svcJson, { email, codigo: key, acao: "assistente" });
    if (!p.ok) return json(p.corpo, p.http);
    key = p.chave;
  }
  if (!demo && !(await chaveConfere(email, key))) return json({ ok: false, error: "unauthorized" }, 401);
  // A assistente é recurso do Pro (lib/deskTrava.js). Legado (sem assinatura do Desk) continua com ela.
  if (!demo) {
    const plano = await svcJson(env, "desk_plano_svc", { p_email: email }).then((r) => (typeof r === "string" ? r : null)).catch(() => null);
    const t = podeNoDesk(plano, "assistente");
    if (!t.ok) return json({ ok: false, error: "plan_required", precisa: t.precisa, plano }, 402);
  }
  if (!env.ELEVENLABS_API_KEY) return json({ ok: false, error: "voice_off" }, 503);
  const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${AGENTE}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } }).catch(() => null);
  const j = r ? await r.json().catch(() => null) : null;
  if (!r || !r.ok || !j?.signed_url) return json({ ok: false, error: "eleven_failed", status: r?.status || 0 }, 502);
  const persona = demo ? null : await personaDo(env, email);
  return json({ ok: true, signed_url: j.signed_url, demo, nome: persona?.nome || "Gui", voz: persona?.voz || null });
}
