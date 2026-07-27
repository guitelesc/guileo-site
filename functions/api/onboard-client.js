// Cloudflare Pages Function — POST /api/onboard-client
// THE ONBOARDING ENGINE: turns a new client live in one call. Admin-token gated; all
// secrets stay server-side. Does, in order:
//   1. saves the client profile (business, lang, review link, forward number)
//   2. creates the credits row + plan (also mints the connection code)
//   3. provisions a dedicated, SALES-FIRST ElevenLabs voice agent from their brain
//   4. number: maps an existing Twilio number OR buys a fresh one — and wires its
//      SMS + Voice webhooks to Gui automatically
//   5. returns the connection code, agent id and number so Luis hands them over.
import { json } from "../lib/guard.js";
import { buildConversationConfig, forwardingInstructions, buildDefaultSchedulePayload } from "../lib/provision.js";
import { emitFailure } from "../lib/failure.js";
import { welcomeSelfServeEmail, sellerClientLiveEmail } from "../lib/emailTemplates.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// RESERVED platform line — the demo/outbound number of the site (ELEVENLABS_PHONE_NUMBER_ID). It must
// NEVER be mapped/bound to a client agent, or approving that client SEQUESTERS the site demo's Gui.
// Same Set as bind-number.js:25 (single source of truth for the rule). Digits-only compare.
const RESERVED_NUMBERS = new Set(["19864443334"]);
const isReserved = (n) => RESERVED_NUMBERS.has((n || "").toString().replace(/[^0-9]/g, ""));

// Build the PRICE LIST the Gui is born knowing (FIX A contract): so it quotes EXACT prices on the first
// call. Accepts an explicit b.prices string, else derives one from the rich scheduling payload services
// (name — $price). Returns "" when nothing priced is available (agent then captures a quote request).
function buildPricesText(b) {
  const explicit = (b && b.prices != null) ? b.prices : "";
  if (typeof explicit === "string" && explicit.trim()) return explicit.slice(0, 2000);
  if (Array.isArray(explicit) && explicit.length) {
    return explicit.map((p) => {
      const nm = (p?.name || "").toString().trim();
      const pr = (p?.price != null ? p.price : (p?.price_cents != null ? (Number(p.price_cents) / 100) : "")).toString().trim();
      return nm ? `${nm}${pr ? ` — $${pr}` : ""}` : "";
    }).filter(Boolean).join("\n").slice(0, 2000);
  }
  const svcs = b?.payload && Array.isArray(b.payload.services) ? b.payload.services : [];
  if (svcs.length) {
    return svcs.map((s) => {
      const nm = (s?.name || "").toString().trim();
      const cents = Number(s?.price_cents);
      const pr = Number.isFinite(cents) && cents > 0 ? `$${(cents / 100).toFixed(2)}` : "";
      return nm ? `${nm}${pr ? ` — ${pr}` : ""}` : "";
    }).filter(Boolean).join("\n").slice(0, 2000);
  }
  return "";
}

async function configureTwilioWebhooks(env, numberSid) {
  const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN;
  const body = new URLSearchParams({ SmsUrl: "https://guileoai.com/api/twilio-inbound", SmsMethod: "POST", VoiceUrl: "https://guileoai.com/api/twilio-voice", VoiceMethod: "POST" });
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${numberSid}.json`, {
    method: "POST", headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
}

// INBOUND → THE CLIENT'S OWN GUI: import the client's Twilio number into ElevenLabs convai and assign
// their dedicated agent, so an inbound call is ANSWERED by their trained Gui (not just forwarded/texted
// back). ElevenLabs auto-configures the Twilio voice webhook on import. agent_id isn't accepted on the
// import body → it's set via PATCH /v1/convai/phone-numbers/{id}. Best-effort; never throws.
async function elevenBindNumber(env, number, agentId, label) {
  if (!env.ELEVENLABS_API_KEY || !env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !number || !agentId) return { ok: false, reason: "missing inputs" };
  try {
    const cr = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
      method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "twilio", phone_number: number, label: (label || "Gui").slice(0, 60), sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN }),
    });
    if (!cr.ok) return { ok: false, reason: `import ${cr.status}: ${(await cr.text().catch(() => "")).slice(0, 160)}` };
    const cd = await cr.json().catch(() => ({}));
    const pnId = cd.phone_number_id || cd.id || "";
    if (!pnId) return { ok: false, reason: "no phone_number_id returned" };
    const pr = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${pnId}`, {
      method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId }),
    });
    if (!pr.ok) return { ok: false, reason: `assign ${pr.status}: ${(await pr.text().catch(() => "")).slice(0, 500)}` };
    return { ok: true, phone_number_id: pnId };
  } catch (e) { return { ok: false, reason: String(e).slice(0, 120) }; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json();
    const token = (b.token || "").toString();
    // AUTH FIRST — verify the admin token before validating fields, so an unauthenticated
    // probe always gets 401 (never a 400 that leaks the expected request shape).
    const vr = await rpc("blitz_stats", { p_token: token, p_email: "" });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    const email = (b.email || "").toString().trim().toLowerCase();
    if (!email.includes("@") || !b.business) return json({ error: "email + business required" }, 400);

    const ING = env.INGEST_SECRET || "";
    const business = b.business.toString().slice(0, 160);
    const lang = ["pt", "es", "en"].includes(b.lang) ? b.lang : "en";
    // agent_name lets a client white-label the voice (e.g. "Sofia"); empty → defaults to the Guileo brand "Gui".
    const agentName = (b.agent_name || "").toString().trim().slice(0, 40) || "Gui";
    const result = { ok: true, steps: {} };

    // 1) profile — greeting/lang/brand of the Gui. A silent failure here = the agent is born with the
    //    wrong name/language and the cockpit shows nothing; check .ok AND emitFailure (never silent).
    try {
      const prf = await rpc("set_client_profile", { p_secret: ING, p_email: email, p_profile: {
        business_name: business, industry: (b.industry || "").toString().slice(0, 80), lang,
        review_link: (b.review_link || "").toString().slice(0, 300), forward_number: (b.forward_number || "").toString().replace(/[^0-9+]/g, ""),
      } });
      result.steps.profile = prf.ok ? "ok" : "err: profile NOT stored";
      if (!prf.ok) await emitFailure(env, "profile_set_failed", email, `set_client_profile ${prf.status} — greeting/lang/brand missing, re-run`, { lang, business });
    } catch (e) { result.steps.profile = "err"; await emitFailure(env, "profile_set_failed", email, `set_client_profile threw: ${String(e).slice(0, 120)} — greeting/lang/brand missing`); }

    // 1.2) OWNER ALERT PHONE — the number the owner's phone RINGS on a real emergency / escalation
    //      (the flagship "the owner's phone rings" feature is INERT without it). Captured in the
    //      wizard (notify_phone), plumbed here. Without this, emergency dispatch degrades to email-only.
    const notifyPhone = (b.notify_phone || "").toString().replace(/[^0-9+]/g, "").slice(0, 20);
    if (notifyPhone) {
      try {
        const nr = await rpc("set_client_notify_phone", { p_secret: ING, p_email: email, p_phone: notifyPhone });
        result.steps.notify_phone = nr.ok ? "ok" : "err";
        if (!nr.ok) await emitFailure(env, "notify_phone_set_failed", email, `set_client_notify_phone ${nr.status} — emergency dispatch can't ring the owner`, {});
      } catch { result.steps.notify_phone = "err"; await emitFailure(env, "notify_phone_set_failed", email, "set_client_notify_phone threw — emergency can't ring the owner"); }
    } else {
      result.steps.notify_phone = "skipped (none captured)";
      await emitFailure(env, "notify_phone_missing", email, `${business} activated WITHOUT an owner alert phone — emergency dispatch & owner-text are email-only until set`, {});
    }

    // 1.5) CADASTRO COMPLETO extras — the white-label bits the base profile RPC doesn't carry:
    //      logo, accent, agent name/voice, the channels map + social/support links. Stored as a jsonb
    //      'extras' blob (db/onboard_completo.sql · profile_extras_set) so the cockpit widget can render
    //      THEIR logo/brand. Best-effort — never blocks the birth of the agent.
    try {
      const ch = (b.channels && typeof b.channels === "object") ? b.channels : {};
      const extras = {
        logo_url: (b.logo_url || "").toString().slice(0, 500),
        accent: (b.accent || "").toString().slice(0, 16),
        agent_name: agentName,
        voice_key: (b.voice_key || "").toString().slice(0, 40),
        channels: ch,
        support_link: (b.support_link || "").toString().slice(0, 300),
        review_link: (b.review_link || "").toString().slice(0, 300),
        social: {
          instagram: ch.instagram?.handle || "", facebook: ch.facebook?.handle || "",
          linkedin: ch.linkedin?.url || "", tiktok: ch.tiktok?.handle || "",
          youtube: ch.youtube?.url || "", google_business: ch.google_business?.url || "",
        },
      };
      const er = await rpc("profile_extras_set", { p_secret: ING, p_email: email, p_extras: extras });
      result.steps.extras = er.ok ? "ok" : "err: extras NOT stored (paste db/onboard_completo.sql)";
      // silent loss of logo/accent/agent-voice/channels = the white-label brand vanishes with no trace.
      if (!er.ok) await emitFailure(env, "profile_extras_failed", email, `profile_extras_set ${er.status} — logo/accent/voice/channels NOT stored (paste db/onboard_completo.sql)`);
    } catch (e) { result.steps.extras = "err"; await emitFailure(env, "profile_extras_failed", email, `profile_extras_set threw: ${String(e).slice(0, 120)} — white-label brand not stored`); }

    // 1.6) PENDING CHANNELS — capture the handle/link NOW (activates when that platform's API is approved,
    //      same wired-but-inert pattern as WhatsApp). One client_integrations placeholder per present
    //      channel (status 'pending') so the cockpit shows it as "aguardando". LIVE channels
    //      (phone/voice, sms, web widget, email) are provisioned elsewhere — never placeholdered here.
    try {
      const ch = (b.channels && typeof b.channels === "object") ? b.channels : {};
      const PENDING = {
        whatsapp: ch.whatsapp?.number, instagram: ch.instagram?.handle, facebook: ch.facebook?.handle,
        linkedin: ch.linkedin?.url, tiktok: ch.tiktok?.handle, youtube: ch.youtube?.url,
        google_business: ch.google_business?.url, ads: ch.ads?.enabled ? "enabled" : "",
        reviews: ch.reviews?.link || b.review_link,
      };
      const pending = [];
      for (const [provider, val] of Object.entries(PENDING)) {
        const handle = (val || "").toString().trim();
        if (!handle) continue;
        try {
          await rpc("store_integration", { p_secret: ING, p_email: email, p_provider: provider, p_tokens: { status: "pending", handle } });
          pending.push(provider);
        } catch { /* best-effort per channel */ }
      }
      result.steps.channels = pending.length ? `aguardando: ${pending.join(", ")}` : "none";
    } catch { result.steps.channels = "err"; }

    // 2) credits row + connection code
    try {
      // credits are what the client PAID for — check the RPC actually landed (fetch doesn't throw on
      // non-2xx, so the old unchecked await could report "ok" while storing nothing = paid-but-nothing).
      const cr = await rpc("add_client_credits", { p_secret: ING, p_email: email, p_credits: Number(b.credits) || 0, p_plan: (b.plan || "").toString().slice(0, 80) });
      const kr = await rpc("admin_get_client_key", { p_token: token, p_email: email });
      result.connection_code = kr.ok ? await kr.json() : null;
      result.steps.credits = cr.ok ? "ok" : "err: credits NOT stored — re-run";
      if (!cr.ok) { result.ok = false; await emitFailure(env, "credits_not_stored", email, "add_client_credits failed during onboarding — re-run", { plan: (b.plan || "").toString() }); }
      // no code = the client can NEVER activate their portal — loudest possible failure
      if (!result.connection_code) await emitFailure(env, "connection_code_missing", email, "admin_get_client_key returned nothing — client has no activation key");
    } catch { result.steps.credits = "err"; result.ok = false; await emitFailure(env, "credits_not_stored", email, "credits step threw during onboarding — re-run"); }

    // 2.2) BIRTH EMAIL moved AFTER the number step (5.5) — it used to fire here, before
    //      result.number existed, so every welcome email shipped with an empty Gui number.

    // 2.5) DAY-1 SCHEDULING SEED — give the business default services + hours so the Gui can actually
    //      check availability and BOOK from the first call. Idempotent: only seeds when the schedule is
    //      empty (so re-onboarding never duplicates). Uses SCHED_SECRET. Best-effort; never blocks.
    if (env.SCHED_SECRET) {
      try {
        const lk = await fetch(`${SB_URL}/rest/v1/rpc/biz_lookup`, {
          method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email }),
        });
        const menu = lk.ok ? await lk.json() : {};
        const hasServices = Array.isArray(menu?.services) && menu.services.length > 0;
        // CADASTRO COMPLETO — if the seller captured a rich scheduling payload (locations + hours +
        // services with price/deposit), import it VERBATIM; otherwise fall back to the day-1 default seed.
        const richPayload = b.payload && typeof b.payload === "object" ? b.payload : null;
        if (richPayload) {
          const sr = await fetch(`${SB_URL}/rest/v1/rpc/biz_admin_import`, {
            method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
            body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email, p_payload: richPayload }),
          });
          const out = sr.ok ? await sr.json().catch(() => ({})) : {};
          // seed failure = the Gui is born WITHOUT services → it can't quote or book (dead core). Alert loud.
          if (!sr.ok || out?.error) {
            result.steps.scheduling = `err: ${out?.error || `import ${sr.status}`}`;
            await emitFailure(env, "scheduling_seed_failed", email, `biz_admin_import (rich) failed — Gui born with NO services, can't book/quote · ${out?.error || sr.status}`, { mode: "rich" });
          } else { result.steps.scheduling = `imported (${out.services ?? "?"} serviços)`; }
        } else if (!hasServices) {
          const payload = buildDefaultSchedulePayload({ industry: b.industry, lang, tz: (b.tz || "America/New_York").toString() });
          const sr = await fetch(`${SB_URL}/rest/v1/rpc/biz_admin_import`, {
            method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
            body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email, p_payload: payload }),
          });
          const out = sr.ok ? await sr.json().catch(() => ({})) : {};
          if (!sr.ok || out?.error) {
            result.steps.scheduling = `err: ${out?.error || `seed ${sr.status}`}`;
            await emitFailure(env, "scheduling_seed_failed", email, `default schedule seed failed — Gui born with NO services, can't book/quote · ${out?.error || sr.status}`, { mode: "default" });
          } else { result.steps.scheduling = `seeded (${out.services ?? "?"} serviços)`; }
        } else { result.steps.scheduling = "already had services"; }
      } catch (e) { result.steps.scheduling = `err: ${String(e).slice(0, 80)}`; await emitFailure(env, "scheduling_seed_failed", email, `scheduling seed threw: ${String(e).slice(0, 120)} — Gui may have no services`); }
    } else { result.steps.scheduling = "skipped (no SCHED_SECRET)"; }

    // 3) provision a dedicated sales-first ElevenLabs agent — IDEMPOTENT: if this client already has
    //    one, UPDATE it in place (so re-running onboarding never duplicates the agent or double-bills),
    //    and the update re-applies the current voice + prompt (so existing agents pick up the new voice).
    if (env.ELEVENLABS_API_KEY) {
      try {
        const brain = (b.brain || "").toString().slice(0, 4000);
        // ONE source of truth: strong LLM (comprehension) + Flash voice + scheduling/booking tool so the
        // Gui actually RECORDS bookings and sends confirmations — not just talks about them.
        // FIX A contract — the Gui must be BORN knowing exact prices so it quotes/closes on call #1.
        const prices = buildPricesText(b);
        const convCfg = buildConversationConfig(env, { business, industry: b.industry, lang, brain, agentName, email, prices, voiceId: (b.voice_id || "").toString().trim() });
        // does this client already have a dedicated agent?
        let existingId = "";
        try { const ar = await rpc("client_agent_lookup", { p_secret: ING, p_email: email }); if (ar.ok) existingId = ((await ar.json()) || "").toString(); } catch { /* best-effort */ }
        if (existingId) {
          const pr = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${existingId}`, {
            method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ conversation_config: convCfg }),
          });
          if (pr.ok) { result.agent_id = existingId; result.steps.agent = `updated existing ${existingId}`; }
          else { result.steps.agent = `err PATCH ${pr.status}: ${(await pr.text().catch(() => "")).slice(0, 500)}`; result.ok = false; await emitFailure(env, "agent_provision_failed", email, `agent PATCH ${pr.status} — client paid, agent NOT updated`, { agent_id: existingId }); }
        } else {
          const res = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
            method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ name: `${agentName} · ${business}`.slice(0, 60), conversation_config: convCfg }),
          });
          if (res.ok) {
            const d = await res.json(); result.agent_id = d.agent_id || d.id || ""; result.steps.agent = "ok";
            // persist the agent_id so calls route + portal syncs the brain; surface persistence failures.
            if (result.agent_id) {
              const sr2 = await rpc("set_client_agent", { p_secret: ING, p_email: email, p_agent_id: result.agent_id });
              if (!sr2.ok) { result.steps.agent = "created_but_NOT_linked — calls won't route"; result.ok = false; await emitFailure(env, "agent_provision_failed", email, `agent ${result.agent_id} created but set_client_agent failed — calls won't route, link manually`, { agent_id: result.agent_id }); }
              // register the tenant→agent map (accessible registry) so speed-to-lead callbacks dial AS
              // their Gui even on a shared number; the number-bind step later adds their el_phone_number_id.
              try { await rpc("client_agent_upsert", { p_secret: ING, p_email: email, p_agent_id: result.agent_id }); } catch { /* best-effort */ }
            } else { result.steps.agent = "created_no_id"; result.ok = false; await emitFailure(env, "agent_provision_failed", email, "agent created but ElevenLabs returned no id — client paid, no routable agent"); }
          } else { result.steps.agent = `err ${res.status}: ${(await res.text().catch(() => "")).slice(0, 500)}`; result.ok = false; await emitFailure(env, "agent_provision_failed", email, `agent create ${res.status} — client paid, NO agent born`); }
        }
      } catch (e) { result.steps.agent = `err: ${String(e).slice(0, 120)}`; result.ok = false; await emitFailure(env, "agent_provision_failed", email, `agent step threw: ${String(e).slice(0, 120)}`); }
    } else { result.steps.agent = "skipped (no ElevenLabs key)"; }

    // 4) number — map existing, or buy a fresh one, then wire webhooks
    const mode = b.number_mode || "shared";
    try {
      if (mode === "existing" && b.existing_number) {
        const num = b.existing_number.toString().replace(/[^0-9+]/g, "");
        // GUARD: refuse the platform's RESERVED demo line — mapping it here would HIJACK the site demo's
        // Gui onto this client (same rule as bind-number.js). Never bind/persist it.
        if (isReserved(num)) {
          result.steps.number = "🚫 recusado: número RESERVADO do demo — mapeie um número livre pro cliente";
          await emitFailure(env, "reserved_number_blocked", email, `tried to map RESERVED demo line ${num} to client — refused (would hijack site demo)`, { number: num });
        } else {
          const snr = await rpc("set_client_number", { p_secret: ING, p_email: email, p_number: num });
          result.number = num; result.steps.number = snr.ok ? "mapped" : `mapped-but-NOT-persisted ${snr.status}`;
          if (!snr.ok) await emitFailure(env, "number_orphaned", email, `set_client_number failed for ${num} — link manually`, { number: num });
        }
      } else if (mode === "buy" && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
        const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN;
        const area = (b.area_code || "").toString().replace(/[^0-9]/g, "");
        const auth = "Basic " + btoa(`${sid}:${tok}`);
        // IDEMPOTENT (crítico $): before spending money on a NEW number, check if this client already has
        // one (provision.js:370 does the same). A re-clicked approve / webhook re-delivery must NOT buy a
        // 2nd $/mo line. If found, reuse it — step 5 re-binds it to the agent (identical outcome).
        let already = "";
        try { const lr = await rpc("client_number_lookup", { p_secret: ING, p_email: email }); if (lr.ok) already = ((await lr.json()) || "").toString(); } catch { /* lookup best-effort → proceed to buy */ }
        if (already) {
          result.number = already; result.steps.number = "reused (client já tinha número — não comprei outro)";
        } else {
        // find one available US local number
        const sr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&VoiceEnabled=true${area ? `&AreaCode=${area}` : ""}&PageSize=1`, { headers: { Authorization: auth } });
        const avail = sr.ok ? await sr.json() : {};
        const pick = avail?.available_phone_numbers?.[0]?.phone_number;
        if (pick) {
          const pr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`, {
            method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ PhoneNumber: pick, SmsUrl: "https://guileoai.com/api/twilio-inbound", SmsMethod: "POST", VoiceUrl: "https://guileoai.com/api/twilio-voice", VoiceMethod: "POST" }),
          });
          if (pr.ok) {
            const pd = await pr.json();
            result.number = pd.phone_number;
            // a number BOUGHT but not linked = orphaned $ + calls that won't route — surface, never fake "wired"
            const snr = await rpc("set_client_number", { p_secret: ING, p_email: email, p_number: pd.phone_number });
            if (snr.ok) { result.steps.number = "bought+wired"; }
            else { result.steps.number = `bought ${pd.phone_number} but NOT linked — link manually`; await emitFailure(env, "number_orphaned", email, `bought ${pd.phone_number} but set_client_number failed — link manually`, { number: pd.phone_number }); }
          }
          else { result.steps.number = "buy_failed"; await emitFailure(env, "number_provision_failed", email, `Twilio buy failed for ${pick}`, { number: pick }); }
        } else { result.steps.number = "none_available"; await emitFailure(env, "number_provision_failed", email, `no US number available${area ? ` (area ${area})` : ""} — map one manually`, {}); }
        }
      } else {
        result.steps.number = "shared (inbound falls to owner; map/buy later for A2P routing)";
      }
    } catch (e) { result.steps.number = "err"; await emitFailure(env, "number_provision_failed", email, `number step threw (mode=${mode}): ${String(e).slice(0, 120)}`); }

    // 5) INBOUND → THE CLIENT'S OWN GUI: with a number AND a dedicated agent, bind them in ElevenLabs
    // so an inbound call is ANSWERED by the client's trained Gui — not merely forwarded or texted back.
    if (result.number && isReserved(result.number)) {
      // last-line guard: never bind the RESERVED demo line to a client agent (would hijack the site demo).
      result.steps.inbound = "🚫 recusado: número RESERVADO do demo — não vinculado";
      await emitFailure(env, "reserved_number_blocked", email, `refused to bind RESERVED demo line ${result.number} to agent ${result.agent_id} (would hijack site demo)`, { number: result.number, agent_id: result.agent_id || "" });
    } else if (result.number && result.agent_id) {
      const bind = await elevenBindNumber(env, result.number, result.agent_id, `${agentName} · ${business}`);
      result.steps.inbound = bind.ok ? "their Gui answers inbound ✅" : `NOT bound: ${bind.reason}`;
      // a number that exists but isn't bound = paid line that never answers — surface it loudly
      if (!bind.ok) { result.ok = false; await emitFailure(env, "inbound_bind_failed", email, `number ${result.number} NOT bound to agent ${result.agent_id}: ${bind.reason}`, { number: result.number, agent_id: result.agent_id }); }
      // PERSIST the tenant→agent map in the ACCESSIBLE registry so /api/call can dial speed-to-lead
      // callbacks AS this client's OWN Gui (their agent + their caller-ID). Best-effort; never blocks.
      try { await rpc("client_agent_upsert", { p_secret: ING, p_email: email, p_agent_id: result.agent_id, p_el_phone_number_id: bind.phone_number_id || "", p_number: result.number }); } catch { /* registry write best-effort */ }
    } else if (result.number) { result.steps.inbound = "skipped (no dedicated agent created)"; }

    // call-forwarding instructions (both options — client picks) so the client routes their own
    // existing business line into this AI number. Surfaced in /admin to hand to the client.
    if (result.number) result.forwarding = forwardingInstructions(result.number, lang);

    // 5.5) BIRTH EMAIL — the strategic first-login moment. The CLIENT automatically receives the
    //      branded welcome with their ACTIVATION KEY (connection code) + their Gui NUMBER (now that
    //      it exists) + first steps, so the handoff scales without Luis copy-pasting codes.
    //      Best-effort: a mail hiccup never blocks activation — but it alerts, never silent.
    try {
      if (env.RESEND_API_KEY && result.connection_code) {
        const { subject, html } = welcomeSelfServeEmail({
          name: (b.owner_name || b.agent_name || "").toString() || email.split("@")[0],
          business: (b.business || "").toString(), lang: (b.lang || "pt").toString(),
          plan: (b.plan || "Personalizado").toString(), code: result.connection_code,
          credits: Number(b.credits) || 0, number: result.number || "",
        });
        const mr = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [email], subject, html }),
        });
        result.steps.birth_email = mr.ok ? "ok" : `err ${mr.status}`;
        // the birth email carries the ACTIVATION KEY — if it fails the client never gets in
        if (!mr.ok) await emitFailure(env, "birth_email_failed", email, `Resend ${mr.status} — activation key never reached the client, resend manually`, { code: result.connection_code });
      } else result.steps.birth_email = "skipped (no RESEND/code)";
    } catch { result.steps.birth_email = "err"; await emitFailure(env, "birth_email_failed", email, "birth email threw — activation key never reached the client, resend manually"); }

    // log the onboarding as a real event
    try { await rpc("ingest_client_event", { p_secret: ING, p_email: email, p_type: "provision", p_channel: "system", p_summary: `🚀 Cliente ativado: ${business}${result.number ? " · " + result.number : ""}`, p_amount: 0, p_payload: { agent_id: result.agent_id || "" } }); } catch { /* */ }

    // golden moment for the SELLER: their wallet client just went LIVE — best-effort, awaited.
    try {
      if (env.RESEND_API_KEY) {
        const sr = await rpc("seller_of_client", { p_secret: ING, p_client_email: email });
        const seller = sr.ok ? await sr.json().catch(() => null) : null;
        if (seller && seller.email) {
          const { subject, html } = sellerClientLiveEmail({
            sellerName: seller.name || "", business: (b.business || "").toString() || email.split("@")[0],
            clientEmail: email, lang: "pt",
          });
          const mr = await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [seller.email], subject, html }),
          });
          result.steps.seller_email = mr.ok ? "ok" : `err ${mr.status}`;
        } else result.steps.seller_email = "skipped (no seller in wallet)";
      }
    } catch { result.steps.seller_email = "err"; }

    return json(result);
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 400);
  }
}
