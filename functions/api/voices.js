// Cloudflare Pages Function — POST /api/voices  (admin-token gated)
//
// LISTA AS VOZES QUE A CONTA REALMENTE TEM, com o idioma nativo de cada uma.
//
// POR QUE EXISTE: o cardápio de vozes da plataforma (src/data/agentVoices.js) tem 8 vozes,
// TODAS nativas do inglês. Elas são "multilingual", então falam português — com sotaque
// americano. O Luis ouviu na hora: "não tá natural". Texto perfeito com voz gringa continua
// soando estrangeiro, e num negócio local isso custa a venda.
//
// Escolher voz brasileira exige saber o voice_id certo. Chutar ID quebra o agente, e inventar
// um ID é o tipo de mentira que só aparece na ligação do cliente. Esta rota pergunta pra
// própria ElevenLabs o que existe na conta e mostra o rótulo de idioma de cada voz.
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const vr = await fetch(`${SB}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: (b.token || "").toString(), p_email: "" }),
    });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);
    if (!env.ELEVENLABS_API_KEY) return json({ ok: false, ready: false, note: "ELEVENLABS_API_KEY não configurada" }, 503);

    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
    if (!r.ok) return json({ ok: false, error: `elevenlabs ${r.status}` }, 502);
    const d = await r.json().catch(() => ({}));

    // O idioma nativo mora em labels.language / labels.accent, e nem toda voz declara.
    // Quando não declara, dizemos "não informado" — nunca adivinhamos que é brasileira.
    const filtro = (b.lang || "").toString().trim().toLowerCase();
    const vozes = (d.voices || []).map((v) => ({
      voice_id: v.voice_id,
      nome: v.name,
      idioma: (v.labels?.language || "").toString() || "não informado",
      sotaque: (v.labels?.accent || "").toString() || "—",
      genero: (v.labels?.gender || "").toString() || "—",
      descricao: (v.labels?.description || "").toString() || "—",
      categoria: v.category || "—",
    }));
    const casa = (v) => !filtro
      || v.idioma.toLowerCase().includes(filtro)
      || v.sotaque.toLowerCase().includes(filtro)
      || v.nome.toLowerCase().includes(filtro);

    const achadas = vozes.filter(casa);
    return json({
      ok: true, total_na_conta: vozes.length, filtro: filtro || null,
      encontradas: achadas.length, vozes: achadas.slice(0, 60),
    });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
