// functions/lib/emergencyCall.js — EMERGENCY DISPATCH: make the OWNER'S PHONE RING.
// Miami thesis: after-hours "no AC / burst pipe / flood" callers don't wait for email —
// they call the next company. So when Gui hears a real emergency, in ADDITION to the
// email/text alert it places a REAL outbound voice call to the owner's registered
// notify phone (same ElevenLabs convai/twilio/outbound-call pattern as /api/call).
// FAIL-OPEN by design: missing env / no phone → { called: false, reason } (never throws),
// so the caller-facing webhook can never break because dispatch isn't configured yet.
// NOTE: this dials the OWNER's own registered alert number (their consent is implicit —
// they set it to be alerted), NOT a customer — so the DNC gate in call.js doesn't apply.
// Customer dials must keep going through /api/call's hardened DNC path.

const ELEVEN_AGENT_ID = "agent_5901ktdkev68f5kb161fmeax1rdm"; // same live Gui default as call.js

// Bilingual-tolerant EN/ES/PT urgency detection — hurricanes, AC, water, power, gas, roof.
// Deliberately loose (word fragments) so "the AC died", "sem ar condicionado", "inundación",
// "vazamento no teto" all match without an exact-phrase list.
const URGENT_RX = [
  /\ba\/?c\b/i,                                                 // "no AC", "AC died", "the A/C is out" — an
  //                                                                escalate mentioning AC in Miami IS urgent
  /\b(no|sem|sin)\s+(air|ar|aire)\b/i,                          // no air / sem ar / sin aire
  /air\s*condition|ar[- ]?condicionado|aire\s*acondicionado/i,
  /flood|inunda|alaga/i,                                        // flood / inundação / inundación / alagamento
  /leak|vazamento|goteira|fuga\s+de\s+agua|fuga\s+de\s+água/i,
  /burst|estour|revent/i,                                       // burst pipe / cano estourou / reventó
  /\b(no|sem|sin)\s+(power|luz|energia|electricidad)\b/i,
  /\broof\b|telhado|techo/i,
  /\bgas\b/i,
  /emergen|urgen/i,                                             // emergency/emergência/emergencia · urgent/urgente
];

// Does this escalate payload signal a genuine drop-everything emergency?
// Explicit flag from the agent brain (urgent/emergency true) OR a tolerant regex hit on the note.
export function isEmergency(b, note) {
  const truthy = (v) => v === true || ["true", "1", "yes", "sim", "si", "sí"].includes(String(v || "").toLowerCase());
  if (truthy(b && b.urgent) || truthy(b && b.emergency)) return true;
  const txt = (note || "").toString();
  return !!txt && URGENT_RX.some((rx) => rx.test(txt));
}

// Place the real voice call to the owner. Returns { called, reason? } — never throws.
export async function callOwnerEmergency(env, { ownerPhone, name, service, phone, business, lang } = {}) {
  try {
    if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_PHONE_NUMBER_ID) return { called: false, reason: "not configured" };
    const to = (ownerPhone || "").toString().replace(/[^0-9+]/g, "");
    if (!/^\+?[1-9]\d{7,14}$/.test(to)) return { called: false, reason: "no owner phone" };
    const who = (name || "").toString().slice(0, 120) || "Um cliente";
    const what = (service || "").toString().slice(0, 200) || "atendimento urgente";
    const cb = (phone || "").toString().slice(0, 40);
    const pt = (lang || "").toString().toLowerCase().startsWith("pt");
    const es = (lang || "").toString().toLowerCase().startsWith("es");
    // What the owner hears the instant they pick up — name, need, callback number, twice-readable.
    const firstMessage = pt ? `Emergência: ${who} precisa de ${what} agora${cb ? ` — retorne ${cb}` : ""}. Repito: ${who}${cb ? `, ${cb}` : ""}.`
      : es ? `Emergencia: ${who} necesita ${what} ahora${cb ? ` — devuelve la llamada al ${cb}` : ""}. Repito: ${who}${cb ? `, ${cb}` : ""}.`
        : `Emergency: ${who} needs ${what} right now${cb ? ` — call back ${cb}` : ""}. Repeating: ${who}${cb ? `, ${cb}` : ""}.`;
    const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: env.ELEVENLABS_AGENT_ID || ELEVEN_AGENT_ID,
        agent_phone_number_id: env.ELEVENLABS_PHONE_NUMBER_ID,
        to_number: to,
        conversation_initiation_client_data: {
          // Override the greeting so the OWNER hears the emergency immediately (not the
          // customer-facing "thanks for calling" opener). Dynamic vars keep the agent on-topic
          // if the owner asks follow-ups ("what's the number again?").
          conversation_config_override: { agent: { first_message: firstMessage } },
          dynamic_variables: { name: who, need: `EMERGENCY DISPATCH · ${what}${cb ? ` · callback ${cb}` : ""}`, business: (business || "").toString().slice(0, 160), lang: (lang || "auto").toString().slice(0, 8) },
        },
      }),
    });
    return { called: res.ok, reason: res.ok ? undefined : `provider ${res.status}` };
  } catch (e) {
    return { called: false, reason: String(e).slice(0, 120) };
  }
}
