// Cloudflare Pages Function — POST /api/call → triggers a real outbound AI phone call.
// PRIMARY: ElevenLabs Conversational AI (same "Gui" agent as the web widget).
//   Secrets in Cloudflare: ELEVENLABS_API_KEY, ELEVENLABS_PHONE_NUMBER_ID
//   (ELEVENLABS_AGENT_ID optional — defaults to the live Gui agent below).
// FALLBACK: Vapi (VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID).
// The caller's context (name/business/industry/need/lang) is passed as dynamic variables so the
// agent greets by name and acts on it — reference {{name}} {{business}} {{need}} in the prompt.
import { sameOrigin, rateLimited, safeEq } from "../lib/guard.js";
import { emitFailure } from "../lib/failure.js";
import { paraE164 } from "../lib/contato.js";

const ELEVEN_AGENT_ID = "agent_5901ktdkev68f5kb161fmeax1rdm";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // SECURITY: outbound calls cost real money — only our own site may trigger them, and the
    // number must be a valid E.164 phone (blocks abuse / robocalling arbitrary numbers).
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    // INTERNAL server-to-server dial (speed-to-lead from /api/lead) carries the shared DIGEST_TOKEN.
    // It bypasses ONLY the per-IP caps below (a legit edge fetch shares one IP and would trip them),
    // never the per-destination cooldown, the global daily cap in lead.js, or the DNC check — those
    // still bound abuse and cost on this path.
    const internal = safeEq(request.headers.get("x-guileo-internal") || "", env.DIGEST_TOKEN || "");
    // Outbound calls cost real money — fail-CLOSED rate limits (deny if KV can't run, so the
    // limiter can't be bypassed by knocking out KV). Two per-IP brakes: 2/min burst + 10/day.
    // NOTE: sameOrigin is forgeable and these are per-IP only — a CAPTCHA/Turnstile challenge
    // on the form is the recommended stronger fix against distributed/headless abuse.
    if (!internal) {
      if (await rateLimited(request, env, "call", 2, 60, /*failClosed*/ true)) return json({ error: "too many requests" }, 429);
      if (await rateLimited(request, env, "call-day", 25, 86400, /*failClosed*/ true)) return json({ error: "too many requests" }, 429);
    }
    const body = await request.json();
    const phone = (body.phone || "").toString().trim();
    if (!phone) return json({ error: "Missing phone" }, 400);
    if (!/^\+?[1-9]\d{7,14}$/.test(phone.replace(/[\s()-]/g, ""))) return json({ error: "Invalid phone" }, 400);

    // ⚠️ A REGEX ACIMA VALIDA FORMA, NÃO DISCABILIDADE — e a diferença custou uma ligação real.
    // "9295350191" (dez dígitos, sem código de país) passa nela e é REJEITADO pela Twilio, que só
    // fala E.164. Em 2026-08-25 o Luis pediu a ligação pelo herói do site: o lead entrou no banco,
    // o telefone nunca tocou, e não sobrou UM registro explicando o porquê. Este é o portão único
    // de discagem, então a conversão mora aqui — vale para o herói, a barra flutuante, o formulário
    // longo e o speed-to-lead do servidor de uma vez só.
    const dial = paraE164(phone);
    if (!dial) {
      // A recusa fala o idioma de quem está lendo — o visitante PT/ES não conserta um erro em inglês.
      const L = (body.lang || "en").toString().slice(0, 2);
      const diga = { pt: "inclui o código do país (ex.: +1 929 535 0191)",
                     es: "incluye el código de país (ej.: +1 929 535 0191)",
                     en: "include the country code (e.g. +1 929 535 0191)" };
      return json({ error: "phone needs country code", reason: diga[L] || diga.en }, 400);
    }

    // COMPLIANCE: this is the single hardened dial point — EVERY call path (front-end direct +
    // server-side speed-to-lead from /api/lead) funnels through here, so the do-not-contact (TCPA
    // STOP / DNC) check lives here, not just in lead.js. Never dial a number that opted out.
    // Fail-OPEN if the suppression service blips (matches lead.js; STOP handling is the primary
    // guarantee and per-IP caps still bound abuse) — a transient DB error must not kill the product.
    const SB_URL = env.GUI_ACTIONS_SUPABASE_URL || "https://ynihodbknhjirkdogxby.supabase.co";
    const SB_ANON = env.GUI_ACTIONS_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
    // FAIL-CLOSED on config: without INGEST_SECRET we can NEVER verify the do-not-contact list, so on
    // the DIALING path we must refuse to call rather than silently dial a possibly-opted-out number
    // (a fail-OPEN here would be a TCPA liability, not a transient blip). A transient RPC error inside
    // the try still falls open — STOP handling + caps remain the backstop for a momentary DB glitch.
    if (!env.INGEST_SECRET) {
      await emitFailure(env, "dnc_check_unavailable", (paraE164(phone) || phone), "INGEST_SECRET missing on dial path — refusing to call (cannot verify DNC/opt-out)", {});
      return json({ error: "cannot verify do-not-call list" }, 503);
    }
    {
      try {
        const e164 = dial;
        const dr = await fetch(`${SB_URL}/rest/v1/rpc/is_dnc`, {
          method: "POST",
          headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_phone: e164 }),
        });
        if (dr.ok && (await dr.json()) === true) return json({ error: "opted out" }, 403);
      } catch { /* DNC service down → fall through; per-IP caps still bound abuse */ }
    }

    // PER-DESTINATION cooldown — bounds abuse that the per-IP caps miss (one victim dialed from
    // many IPs, or a double-submit). At most one call per number per 10 min on this hardened path.
    // Best-effort: if KV is down we don't block the call (per-IP caps remain the backstop).
    if (env.RATE_LIMIT) {
      try {
        const dest = dial;
        if (await env.RATE_LIMIT.get(`calldest:${dest}`)) return json({ ok: true, skipped: "recently called" });
        await env.RATE_LIMIT.put(`calldest:${dest}`, "1", { expirationTtl: 600 });
      } catch { /* KV blip → proceed; IP caps backstop */ }
    }

    const vars = {
      name: (body.name || "").toString().slice(0, 120),
      business: (body.business || "").toString().slice(0, 160),
      industry: (body.industry || "").toString().slice(0, 80),
      need: (body.need || "").toString().slice(0, 300),
      lang: (body.lang || "auto").toString().slice(0, 8),
    };

    // ── PER-TENANT AGENT (internal dial path only) ──
    // A speed-to-lead callback can dial AS the client's OWN Gui (their voice/name/prices/KB, and
    // their own caller-ID when their number is registered). SECURITY: we NEVER trust a client-supplied
    // agent_id (format != authorization). The agent is resolved SERVER-SIDE from the tenant email via
    // the INGEST-gated client_agent_resolve, and ONLY on the INTERNAL path (x-guileo-internal ==
    // DIGEST_TOKEN). A public caller (no internal token) always gets the platform agent — it cannot
    // request another tenant's agent. Unknown/absent tenant → platform agent (no regression).
    let agentId = env.ELEVENLABS_AGENT_ID || ELEVEN_AGENT_ID;
    let agentPhoneId = env.ELEVENLABS_PHONE_NUMBER_ID;
    if (internal && body.client_email && /.+@.+\..+/.test(String(body.client_email))) {
      try {
        const rr = await fetch(`${SB_URL}/rest/v1/rpc/client_agent_resolve`, {
          method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: String(body.client_email).toLowerCase() }),
        });
        if (rr.ok) {
          const a = await rr.json().catch(() => null);
          if (a && a.agent_id) agentId = a.agent_id;                          // the client's own Gui
          if (a && a.el_phone_number_id) agentPhoneId = a.el_phone_number_id;  // their caller-ID (same ElevenLabs workspace)
        }
      } catch { /* resolve down → platform agent (no regression) */ }
    }

    // ── PRIMARY: ElevenLabs Conversational AI outbound call (via Twilio) ──
    if (env.ELEVENLABS_API_KEY && agentPhoneId) {
      const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
        method: "POST",
        headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          agent_phone_number_id: agentPhoneId,
          to_number: dial,
          conversation_initiation_client_data: { dynamic_variables: vars },
        }),
      });
      // ⚠️ ANTES ISTO SÓ FAZIA console.log — e um log de edge que ninguém lê é o mesmo que silêncio.
      // Foi assim que a recusa da Twilio pelo número sem código de país não deixou rastro nenhum.
      if (!res.ok) {
        const det = await res.text().catch(() => "");
        await emitFailure(env, "call_provider_error", dial, `ElevenLabs recusou a discagem (HTTP ${res.status})`, { detalhe: det.slice(0, 300), agent_id: agentId });
        return json({ error: "call provider error", reason: `provedor recusou (HTTP ${res.status})` }, 502);
      }
      return json({ ok: true, provider: "elevenlabs" });
    }

    // ── FALLBACK: Vapi ──
    if (env.VAPI_API_KEY && env.VAPI_ASSISTANT_ID && env.VAPI_PHONE_NUMBER_ID) {
      const res = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.VAPI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId: env.VAPI_ASSISTANT_ID,
          phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
          customer: { number: dial, name: vars.name || undefined },
          assistantOverrides: { variableValues: vars },
        }),
      });
      if (!res.ok) {
        await emitFailure(env, "call_provider_error", dial, `Vapi recusou a discagem (HTTP ${res.status})`, {});
        return json({ error: "call provider error", reason: `provedor recusou (HTTP ${res.status})` }, 502);
      }
      return json({ ok: true, provider: "vapi" });
    }

    return json({ error: "Outbound calling not configured yet" }, 501);
  } catch {
    return json({ error: "bad request" }, 400);
  }
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
