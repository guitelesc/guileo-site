// Cloudflare Pages Function — POST /api/bind-number  (admin-token gated)
// ROTA-NUMERO: mapeia um número Twilio JÁ EXISTENTE na conta ao agente ElevenLabs de um tenant
// que nasceu com number=null. Importa o número no convai + PATCH agent_id (auto-configura o
// webhook de voz do Twilio). Idempotente-ish: re-mapear o mesmo número só reafirma o agente.
// NÃO mexe em agenda/dados — só liga a VOZ. Admin verificado via blitz_stats (mesma porta do /admin).
import { json } from "../lib/guard.js";
import { elevenBindNumber } from "../lib/provision.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const token = (b.token || "").toString();
    const email = (b.email || "").toString().trim().toLowerCase();
    const number = (b.number || "").toString().replace(/[^0-9+]/g, "");
    if (!email.includes("@")) return json({ error: "email required" }, 400);
    if (!/^\+?[0-9]{8,15}$/.test(number)) return json({ error: "número inválido (use E.164, ex: +13055551234)" }, 400);
    // GUARD: the platform demo/outbound line is RESERVED — never bind it to a client agent.
    const RESERVED = new Set(["19864443334"]);
    if (RESERVED.has(number.replace(/[^0-9]/g, ""))) return json({ error: "🚫 Esse é o número RESERVADO do demo do site — escolha um número livre pro cliente." }, 400);

    // ── ADMIN GATE (same as setup-business / onboard-client) ──
    const vr = await rpc("blitz_stats", { p_token: token, p_email: "" });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    if (!env.ELEVENLABS_API_KEY) return json({ error: "ELEVENLABS_API_KEY não configurada" }, 501);

    // find this tenant's dedicated agent (born on approval)
    let agentId = "";
    try {
      const ar = await rpc("client_agent_lookup", { p_secret: env.INGEST_SECRET || "", p_email: email });
      if (ar.ok) agentId = ((await ar.json()) || "").toString();
    } catch { /* */ }
    if (!agentId) return json({ error: "esse cliente não tem agente ainda — aprove o cadastro primeiro" }, 400);

    // import the number into ElevenLabs convai + assign the agent (auto-wires Twilio voice webhook)
    const bind = await elevenBindNumber(env, number, agentId, email.split("@")[0]);
    if (!bind || !bind.ok) return json({ ok: false, note: "não consegui mapear o número — confira se ele está na conta Twilio", detail: bind && bind.reason });

    // best-effort: record the live number on the draft so /admin shows it
    try { await rpc("draft_set_number", { p_secret: env.INGEST_SECRET || "", p_email: email, p_number: number }); } catch { /* optional RPC */ }

    return json({ ok: true, agent_id: agentId, number, phone_number_id: bind.phone_number_id, note: "Número mapeado — a Lilian/agente já atende nesse número." });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
