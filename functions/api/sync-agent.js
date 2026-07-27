// Cloudflare Pages Function — POST /api/sync-agent
// Loop 2: when a client edits their AI brain in the portal, push it to their LIVE
// ElevenLabs voice agent's prompt — so "Train your AI" actually trains the real agent.
//   POST { email, key, brain, business?, industry?, lang? }
// Auth: the connection code (key) must match the client (verified via get_client_data).
import { json } from "../lib/guard.js";
import { buildConversationConfig, fetchTenantPrices } from "../lib/provision.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.ELEVENLABS_API_KEY) return json({ ready: false, error: "elevenlabs not configured" }, 501);
    const b = await request.json();
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "email + key required" }, 400);

    // AUTH — the connection code must belong to this client (get_client_data rejects a mismatch).
    const gr = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gr.ok) return json({ error: "unauthorized" }, 401);

    // find this client's dedicated agent (server-side, ingest-secret gated)
    const ar = await rpc("client_agent_lookup", { p_secret: env.INGEST_SECRET || "", p_email: email });
    const agentId = ar.ok ? ((await ar.json()) || "").toString() : "";
    if (!agentId) return json({ ok: false, error: "no agent provisioned for this client yet" }, 404);

    const business = (b.business || "").toString().slice(0, 160);
    const industry = (b.industry || "").toString().slice(0, 80);
    const lang = ["pt", "es", "en"].includes(b.lang) ? b.lang : "en";
    const brain = (b.brain || "").toString().slice(0, 4000);

    // KB — re-inject the tenant's own Q&A (client_kb) so a brain sync NEVER strips the business
    // knowledge the way provisioning injects it. Best-effort; empty/missing → brain unchanged.
    let kbBrain = brain;
    try {
      const kr = await rpc("kb_for_agent", { p_secret: env.INGEST_SECRET || "", p_email: email });
      if (kr.ok) { const kb = ((await kr.json()) || "").toString().slice(0, 1600); if (kb.trim()) kbBrain = `${brain || ""}\n\nBUSINESS FAQ (answer these exactly as the owner wrote them):\n${kb}`.trim(); }
    } catch { /* KB is a bonus — never blocks a sync */ }

    // PRICES — inject the tenant's REAL live menu so editing the brain never strips the prices the Gui
    // quotes on a call (biz_lookup, SCHED_SECRET; best-effort "" on any miss).
    const prices = await fetchTenantPrices(env, email, lang);

    // Preserve whatever VOICE + NAME the agent currently uses — read them off the live agent so a brain
    // sync never reverts the voice OR resets the white-label name to the brand-default "Gui" (the root
    // cause of "answered as Gui": sync used to drop agentName, so buildGuiPrompt fell back to "Gui").
    let voiceId = "", liveName = "";
    try {
      const gv = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (gv.ok) { const gd = await gv.json().catch(() => ({})); voiceId = (gd?.conversation_config?.tts?.voice_id || "").toString(); liveName = (gd?.name || "").toString(); }
    } catch { /* fall back to env default inside buildConversationConfig */ }
    // explicit name from the caller wins; else keep the agent's current white-label name ("{name} · {business}")
    let agentName = (b.agent_name || "").toString().trim().slice(0, 40);
    if (!agentName && liveName.includes(" · ")) agentName = liveName.split(" · ")[0].trim();

    // ONE source of truth — the SAME builder provisioning uses. Rebuilding the prompt inline here used to
    // (1) DROP the tools + toolHint (schedule/do_action) AND the 🚨 emergency-escalation protocol, and
    // (2) PATCH a FIXED tts.model_id=flash_v2_5, which ElevenLabs REJECTS for English-PRIMARY agents
    // ("English Agents must use turbo or flash v2") → a 502 where the brain edit silently never landed.
    // buildConversationConfig keeps the tools + protocol AND picks the tts model by language, so editing
    // the brain in the portal never again breaks the agent.
    const convCfg = buildConversationConfig(env, { business, industry, lang, brain: kbBrain, agentName, email, prices, voiceId });
    const pr = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: "PATCH",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      // also persist the agent NAME so the white-label sticks across the ElevenLabs dashboard too
      body: JSON.stringify({ conversation_config: convCfg, ...(agentName && business ? { name: `${agentName} · ${business}`.slice(0, 60) } : {}) }),
    });
    if (!pr.ok) { try { console.log("sync-agent error", (await pr.text()).slice(0, 300)); } catch { /* */ } return json({ error: "agent update failed" }, 502); }

    // log the retrain as a (free) event for the client's timeline
    try { await rpc("ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "train", p_channel: "system", p_summary: "AI brain synced to your live voice agent", p_amount: 0, p_payload: { agent_id: agentId } }); } catch { /* */ }

    return json({ ok: true, agent_id: agentId });
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}
