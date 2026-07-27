// Cloudflare Pages Function — POST /api/booking-intent  (GROWTH INTELLIGENCE)
// Public-ish endpoint the booking widget / booking flow calls to track intent so an
// abandoned booking (started but never finished) can be recovered by Gui later.
//   POST { email, action:"start",    contact, name?, service?, source? } -> { ok, id }
//   POST { email, action:"complete", contact?, intent_id? }              -> { ok, completed }
// The tenant `email` must be a REAL provisioned account (gi_tenant_known, INGEST-gated
// server-side) — unknown emails get 404 so randoms can't spam the intents table.
// Guarded by sameOrigin (front-end only) + a light per-IP rate limit. INGEST_SECRET
// stays server-side. This is standalone — it does NOT touch widget-chat.js. Wire it
// from the booking widget/flow: call action:"start" the moment a visitor gives a
// phone/email in the booking UI, and action:"complete" when the booking confirms.
import { json, corsHeaders, sameOrigin, rateLimited } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function onRequestOptions() { return new Response(null, { headers: corsHeaders }); }

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // Browser-only: an Origin/Referer from our site. Blocks header-less curl spam.
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    // Light abuse brake — fail-open so a real visitor is never blocked by a KV hiccup.
    if (await rateLimited(request, env, "booking-intent", 30)) return json({ error: "too many requests" }, 429);

    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    if (!email.includes("@")) return json({ error: "bad email" }, 400);
    const secret = env.INGEST_SECRET || "";

    // TENANT GATE — unknown emails don't get a row (stops enumeration/junk inserts).
    const kr = await rpc("gi_tenant_known", { p_secret: secret, p_email: email });
    if (!kr.ok) {
      // RPC not present yet (SQL not pasted) → honest note, never a 500.
      return json({ ok: false, ready: false, note: "Paste db/growth_intel.sql in Supabase to activate booking intent tracking." });
    }
    const known = await kr.json().catch(() => false);
    if (known !== true) return json({ error: "unknown tenant" }, 404);

    const action = (b.action || "start").toString();
    const contact = (b.contact || "").toString().trim().slice(0, 160);
    const intentId = (b.intent_id || "").toString().trim();

    if (action === "complete") {
      const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(intentId);
      const cr = await rpc("booking_intent_complete", {
        p_secret: secret, p_client_email: email,
        p_contact: contact || null, p_intent_id: validId ? intentId : null,
      });
      if (!cr.ok) return json({ ok: false, completed: false });
      const done = await cr.json().catch(() => false);
      return json({ ok: true, completed: done === true });
    }

    // default: start — needs SOME contact handle to be recoverable later
    if (!contact) return json({ error: "contact required" }, 400);
    const sr = await rpc("booking_intent_start", {
      p_secret: secret, p_client_email: email, p_contact: contact,
      p_name: (b.name || "").toString().slice(0, 120) || null,
      p_service: (b.service || "").toString().slice(0, 120) || null,
      p_source: (b.source || "widget").toString().slice(0, 40),
    });
    if (!sr.ok) return json({ ok: false, id: null });
    const id = await sr.json().catch(() => null);
    return json({ ok: true, id: typeof id === "string" ? id : null });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
