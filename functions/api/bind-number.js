// Cloudflare Pages Function — POST /api/bind-number  (admin-token gated)
// ROTA-NUMERO: mapeia um número Twilio JÁ EXISTENTE na conta ao agente ElevenLabs de um tenant
// que nasceu com number=null. Importa o número no convai + PATCH agent_id (auto-configura o
// webhook de voz do Twilio). Idempotente-ish: re-mapear o mesmo número só reafirma o agente.
// NÃO mexe em agenda/dados — só liga a VOZ. Admin verificado via blitz_stats (mesma porta do /admin).
import { json } from "../lib/guard.js";
import { elevenBindNumber } from "../lib/provision.js";
import { isReserved } from "../lib/reserved.js";

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
    /* 🚫 TRAVA DO DONO OCUPADO (Luis, 25/08: «nunca perca a linha da Lilian ou a do Natura Spa;
       a nossa nunca use pra nada»).
       O portão abaixo protege a linha da própria Guileo. Faltava a outra metade: um número que
       JÁ atende por um cliente real podia ser reapontado para outro tenant sem um único aviso —
       e o telefone do cliente pagante passaria a atender como outra empresa. Não é hipótese:
       a linha de demo da Guileo já atendeu como o spa da Natura por causa disso.
       Regra: reapontar um número que pertence a OUTRO tenant exige `forcar: true` explícito.
       Reamarrar o número ao MESMO dono continua livre (é o conserto normal, não a troca). */
    const donoAtual = await rpc("client_email_by_number", { p_secret: env.INGEST_SECRET || "", p_number: number })
      .then((r) => (r && r.ok ? r.json() : null)).then((v) => (v || "").toString().trim().toLowerCase()).catch(() => null);
    // ⚠️ `null` aqui é "não consegui checar", NÃO "está livre". Falhar a leitura e seguir em
    // frente é como se perde a linha de um cliente sem ninguém perceber.
    if (donoAtual === null) {
      return json({ error: "não consegui verificar de quem é este número — recuso mapear às cegas" }, 503);
    }
    if (donoAtual && donoAtual !== email && b.forcar !== true) {
      return json({ error: `🚫 ${number} já atende por ${donoAtual}. Reapontar tiraria o telefone desse cliente. Se é isso mesmo, repita com "forcar": true.` }, 409);
    }

    // GUARD: the platform demo/outbound line is RESERVED — never bind it to a client agent.
    // A lista vive em lib/reserved.js porque o /api/provision-number precisa da MESMA — duas
    // cópias divergem no dia em que alguém acrescenta um número só numa delas.
    if (isReserved(number)) return json({ error: "🚫 Esse é o número RESERVADO do demo do site — escolha um número livre pro cliente." }, 400);

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
    // ⚠️ NÃO passe mais `email.split("@")[0]` como rótulo — era daqui que saía o carimbo
    // "naturaspaadm" gravado nos TRÊS números da conta, inclusive na linha de demo da Guileo.
    // O rótulo agora nasce do agente lá dentro; isto aqui é só a rede para provedor mudo.
    const bind = await elevenBindNumber(env, number, agentId, `Gui · ${email}`);
    if (!bind || !bind.ok) return json({ ok: false, note: "não consegui mapear o número — confira se ele está na conta Twilio", detail: bind && bind.reason });

    // register the mapped number EVERYWHERE the onboard path does (onboard-client.js step 5), so the
    // number is consistently known to the agent/CRM — not just wired in ElevenLabs. set_client_number is
    // the canonical tenant→number link; surface its failure (never leave the number silently orphaned).
    const snr = await rpc("set_client_number", { p_secret: env.INGEST_SECRET || "", p_email: email, p_number: number });
    if (!snr || !snr.ok) return json({ ok: false, agent_id: agentId, number, phone_number_id: bind.phone_number_id, note: `número mapeado na voz, mas NÃO registrado no CRM (set_client_number ${snr && snr.status}) — o agente/CRM pode não reconhecer o número; tente de novo` });
    // register the tenant→agent map in the accessible registry (same as onboard step 5) so /api/call
    // dials speed-to-lead callbacks AS this client's OWN Gui + their el_phone_number_id. Best-effort.
    try { await rpc("client_agent_upsert", { p_secret: env.INGEST_SECRET || "", p_email: email, p_agent_id: agentId, p_el_phone_number_id: bind.phone_number_id || "", p_number: number }); } catch { /* registry write best-effort */ }

    // best-effort: record the live number on the draft so /admin shows it
    try { await rpc("draft_set_number", { p_secret: env.INGEST_SECRET || "", p_email: email, p_number: number }); } catch { /* optional RPC */ }

    return json({ ok: true, agent_id: agentId, number, phone_number_id: bind.phone_number_id, note: "Número mapeado — a Lilian/agente já atende nesse número." });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
