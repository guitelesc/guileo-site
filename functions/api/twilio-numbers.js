// Cloudflare Pages Function — POST /api/twilio-numbers  (admin-token gated)
// Lists the Twilio account's phone numbers so /admin can show them (pick the spare one to map to
// an agent via ROTA-NUMERO / bind-number). Also flags which numbers are already imported into
// ElevenLabs convai (so you don't remap a number that's already answering for another agent).
// Server holds TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN; the browser never sees them.
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const token = (b.token || "").toString();
    // admin gate (same blitz_stats door as the rest of /admin)
    const vr = await fetch(`${SB}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token, p_email: "" }),
    });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return json({ ok: false, note: "TWILIO_ACCOUNT_SID/AUTH_TOKEN não configurados" });
    const auth = "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

    // 1) all numbers on the Twilio account
    const tr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=100`, { headers: { Authorization: auth } });
    if (!tr.ok) return json({ ok: false, note: `Twilio respondeu ${tr.status}` });
    const td = await tr.json().catch(() => ({}));
    const nums = (td.incoming_phone_numbers || []).map((n) => ({
      number: n.phone_number, friendly: n.friendly_name || "",
      voice: (n.voice_url || "").includes("guileoai.com") || (n.voice_url || "").includes("elevenlabs"),
    }));

    // 2) which numbers are imported into ElevenLabs convai, and to WHICH agent
    const agentByNumber = {}; // phone_number -> agent_id
    if (env.ELEVENLABS_API_KEY) {
      try {
        const er = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
        if (er.ok) {
          const ed = await er.json().catch(() => []);
          (Array.isArray(ed) ? ed : (ed.phone_numbers || [])).forEach((p) => {
            if (p && p.phone_number) agentByNumber[p.phone_number] = (p.assigned_agent && (p.assigned_agent.agent_id || p.assigned_agent)) || p.agent_id || "";
          });
        }
      } catch { /* best-effort */ }
    }
    // 3) map agent_id -> business name (from onboard_drafts, so "8170 → Natura Spa" is obvious)
    const bizByAgent = {};
    try {
      const dr = await fetch(`${SB}/rest/v1/onboard_drafts?select=agent_id,business,number&status=eq.live`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
      if (dr.ok) { const rows = await dr.json().catch(() => []); (rows || []).forEach((r) => { if (r.agent_id) bizByAgent[r.agent_id] = r.business || ""; }); }
    } catch { /* best-effort */ }

    // RESERVED = the platform's demo/outbound line — NEVER assignable to a client.
    const RESERVED = new Set(["19864443334"]);
    const out = nums.map((n) => {
      const digits = n.number.replace(/[^0-9]/g, "");
      const reserved = RESERVED.has(digits);
      const agent = agentByNumber[n.number] || "";
      return {
        ...n, reserved,
        bound: reserved || !!agent,
        agent_id: reserved ? "" : agent,
        business: reserved ? "Plataforma (demo)" : (bizByAgent[agent] || ""),
        where: reserved ? "🚫 RESERVADO — demo do site (não usar em cliente)"
          : agent ? (bizByAgent[agent] ? `Agente de ${bizByAgent[agent]}` : "Ligado a um agente")
          : "Livre",
      };
    });
    // free numbers first, reserved last
    out.sort((a, b) => ((a.reserved || a.bound) === (b.reserved || b.bound) ? 0 : (a.reserved || a.bound) ? 1 : -1));
    // DIAGNÓSTICO DA CONTA — qual conta Twilio a plataforma está REALMENTE usando, e com
    // quanto saldo. Sem isto o /admin lista números sem dizer de onde vêm: em 2026-08 havia
    // duas contas (a antiga e uma nova de trial) e ninguém sabia pra qual os segredos
    // apontavam. Número sem saldo é telefone mudo — o cliente só descobre na 1ª ligação.
    const acct = { sid: (env.TWILIO_ACCOUNT_SID || "").slice(0, 10) + "…", from: env.TWILIO_FROM || null };
    try {
      const [br, ar] = await Promise.all([
        fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Balance.json`, { headers: { Authorization: auth } }),
        fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}.json`, { headers: { Authorization: auth } }),
      ]);
      if (br.ok) { const b = await br.json().catch(() => ({})); acct.balance_usd = Number(b.balance); acct.currency = b.currency; }
      if (ar.ok) { const a = await ar.json().catch(() => ({})); acct.friendly_name = a.friendly_name; acct.status = a.status; acct.type = a.type; }
    } catch { acct.note = "não consegui ler saldo/estado da conta"; }
    // Trial não liga pra número não-verificado: é a diferença entre "funciona no teste" e
    // "funciona pro cliente". Diga isso em voz alta, não deixe descobrir no cliente.
    acct.trial = acct.type === "Trial";
    if (acct.trial) acct.aviso = "CONTA TRIAL — só liga pra números verificados. Faça upgrade antes de vender.";
    if (Number.isFinite(acct.balance_usd) && acct.balance_usd < 20) acct.aviso_saldo = `Saldo $${acct.balance_usd.toFixed(2)} — recarregue; sem saldo o telefone fica mudo.`;

    return json({ ok: true, count: out.length, numbers: out, account: acct });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
