// Cloudflare Pages Function — POST /api/blitz?token=DIGEST_TOKEN
// The Reactivation Blitz engine (the highest-ROI product: 400-800% ROI). Pulls the next
// batch of a client's dormant contacts and has Gui reach out — voice call for the warmest
// channel, SMS otherwise — ALWAYS skipping the do-not-contact (TCPA opt-out) list. Marks
// each contacted + logs a real event so the client watches the money come back live.
// Driven by the cron Worker every few minutes; rate-capped so it never floods carriers.
import { json, safeEq } from "../lib/guard.js";
import { sendText } from "../lib/twilio.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const ELEVEN_AGENT_ID = "agent_5901ktdkev68f5kb161fmeax1rdm";

const rpc = (env, name, args) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
});

async function profile(env, email) {
  try { const r = await rpc(env, "get_client_profile", { p_email: email }); if (r.ok) return await r.json(); } catch { /* */ }
  return {};
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (request.method !== "GET" && request.method !== "POST") return json({ error: "method" }, 405);
    const tok = new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
    if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

    // pull the next batch (RPC already excludes do-not-contact numbers)
    const dr = await rpc(env, "due_blitz", { p_limit: 25 });
    const batch = dr.ok ? await dr.json() : [];
    if (!Array.isArray(batch) || batch.length === 0) return json({ ok: true, sent: 0, reason: "nothing due" });

    const profByClient = {};
    let sent = 0, called = 0, texted = 0, skipped = 0;

    for (const c of batch) {
      const phone = (c.phone || "").replace(/[^0-9+]/g, "");
      if (!phone) { await rpc(env, "mark_dormant", { p_id: c.id, p_status: "failed" }); skipped++; continue; }
      if (!profByClient[c.client_email]) profByClient[c.client_email] = await profile(env, c.client_email);
      const p = profByClient[c.client_email];
      const lang = (p.lang === "pt") ? "pt" : (p.lang === "es" ? "es" : "en");
      const biz = p.business_name || "";
      const first = (c.name || "").split(" ")[0];

      let ok = false;
      // VOICE first (best for reactivation) when ElevenLabs is configured; else SMS.
      if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_PHONE_NUMBER_ID && c.channel === "voice") {
        try {
          const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
            method: "POST",
            headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ agent_id: env.ELEVENLABS_AGENT_ID || ELEVEN_AGENT_ID, agent_phone_number_id: env.ELEVENLABS_PHONE_NUMBER_ID, to_number: phone,
              conversation_initiation_client_data: { dynamic_variables: { name: c.name || "", business: biz, need: "win-back / reactivation", lang } } }),
          });
          ok = res.ok; if (ok) called++;
        } catch { /* fall through to text */ }
      }
      if (!ok) {
        const msg = lang === "pt"
          ? `Oi ${first || ""}! 🌱 Aqui é o Gui, da ${biz || "sua empresa"}. Faz um tempinho que a gente não te vê — quer agendar um horário essa semana? É só responder aqui! (responda SAIR pra não receber mais)`
          : lang === "es"
          ? `¡Hola ${first || ""}! 🌱 Soy Gui, de ${biz || "tu negocio"}. Hace tiempo que no te vemos — ¿quieres reservar esta semana? ¡Responde aquí! (responde STOP para no recibir más)`
          : `Hi ${first || ""}! 🌱 This is Gui from ${biz || "your business"}. It's been a while — want to book a time this week? Just reply here! (reply STOP to opt out)`;
        const r = await sendText(env, phone, msg);
        ok = r.sent; if (ok) texted++;
      }

      if (ok) {
        await rpc(env, "mark_dormant", { p_id: c.id, p_status: "contacted" });
        await rpc(env, "ingest_client_event", { p_email: c.client_email, p_type: "winback", p_channel: c.channel === "voice" ? "voice" : "sms",
          p_summary: `♻️ Reativação: Gui contatou ${c.name || phone}`, p_amount: 0, p_payload: { phone } });
        sent++;
      } else { skipped++; }
    }

    return json({ ok: true, sent, called, texted, skipped, batch: batch.length });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 120) }, 500);
  }
}
