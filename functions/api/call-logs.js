// Cloudflare Pages Function — POST /api/call-logs  { email, key }
// Returns the client's real calls WITH per-call analysis (sentiment/intent/duration/why-it-ended)
// and the full transcript. Two-step, mirroring billing-portal's gate:
//   1) validate email+key via get_client_data on the legacy data project (rejects a mismatch)
//   2) read the analysis+transcript from call_logs in the OWNED project (gated by SCHED_SECRET)
import { json, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";

// legacy data project — used ONLY to validate the connection key (same gate as fetchRealData)
const DATA_SB = "https://ynihodbknhjirkdogxby.supabase.co";
const DATA_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
// owned project — where the transcripts live
const SCHED_SB = "https://ynihodbknhjirkdogxby.supabase.co";
const SCHED_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

async function validClient(email, key) {
  try {
    const r = await fetch(`${DATA_SB}/rest/v1/rpc/get_client_data`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: DATA_ANON, Authorization: `Bearer ${DATA_ANON}` },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!r.ok) return false;
    const d = await r.json();
    return d && typeof d === "object" && Array.isArray(d.events);
  } catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { /* */ }
  const email = (body.email || "").toString().trim().toLowerCase();
  const key = (body.key || "").toString().trim();
  if (!email || !key) return json({ error: "missing email/key" }, 400);
  // 🚨 NUNCA devolver lista vazia quando a verdade é "não consegui ler".
  // Para a dona do negócio, `calls: []` significa "a Gui não atendeu ninguém" — e ela vai
  // acreditar. Um ambiente sem SCHED_SECRET, um RPC fora do ar ou um erro de rede viram, os três,
  // a MESMA tela de "nenhuma ligação". É o defeito que mais custa confiança de cliente pagante,
  // e é a lição do repo sobre fallback que esconde erro. Agora cada falha se identifica.
  if (!env.SCHED_SECRET) return json({ calls: [], nao_deu_pra_ler: true, motivo: "sem SCHED_SECRET neste ambiente" });

  if (!(await validClient(email, key))) return json({ error: "unauthorized" }, 401);

  // ── OUVIR A LIGAÇÃO (2026-09-28) — { email, key, audio: <id da linha> } → o MP3 da ElevenLabs.
  // O id sozinho não autoriza: o banco só devolve o conversation_id se a ligação for DESTE e-mail
  // (call_log_conv), e o e-mail acabou de ser validado com a chave. A chave da ElevenLabs nunca
  // sai do servidor — o áudio passa por aqui. Sem gravação: diz que não há, não finge tocar.
  if (body.audio) {
    const id = String(body.audio);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, motivo: "id inválido" }, 400);
    if (await rateLimited(request, env, "call-audio", 30)) return json({ ok: false, motivo: "muitos pedidos — tente em 1 minuto" }, 429);
    if (!env.ELEVENLABS_API_KEY) return json({ ok: false, motivo: "gravações indisponíveis neste ambiente" }, 503);
    const conv = await svcJson(env, "call_log_conv", { p_secret: env.SCHED_SECRET, p_email: email, p_id: id }).catch(() => null);
    if (!conv || typeof conv !== "string") return json({ ok: false, motivo: "ligação não encontrada nesta conta" }, 404);
    const ar = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conv)}/audio`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
    if (!ar.ok) return json({ ok: false, motivo: ar.status === 404 ? "a gravação desta ligação não está disponível" : `o provedor de voz respondeu HTTP ${ar.status}` }, ar.status === 404 ? 404 : 503);
    return new Response(ar.body, { headers: { "Content-Type": ar.headers.get("content-type") || "audio/mpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }

  try {
    const r = await fetch(`${SCHED_SB}/rest/v1/rpc/get_call_logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SCHED_ANON, Authorization: `Bearer ${SCHED_ANON}` },
      body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email, p_limit: 100 }),
    });
    if (!r.ok) return json({ calls: [], nao_deu_pra_ler: true, motivo: `a base de ligações respondeu HTTP ${r.status}` });
    const d = await r.json();
    return json({ calls: Array.isArray(d?.calls) ? d.calls : [] });
  } catch (e) { return json({ calls: [], nao_deu_pra_ler: true, motivo: `falha de rede lendo as ligações: ${(e && e.message) || e}` }); }
}
