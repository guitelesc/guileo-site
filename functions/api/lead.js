// Cloudflare Pages Function — POST /api/lead → captures a lead (name + email/phone/contact).
// Leads ALWAYS land in the gui_actions store (the same feed /admin and /live read), so Luis
// sees every lead and can close it. Optionally also forwards to LEAD_WEBHOOK (Zapier/Sheet/CRM)
// and a Supabase `leads` table.
import { sameOrigin, rateLimited } from "../lib/guard.js";
import { leadReceivedEmail, leadAlertEmail } from "../lib/emailTemplates.js";
import { emitFailure } from "../lib/failure.js";
import { svcRpc } from "../lib/sb.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // SECURITY: only our own site forms may post leads (blocks header-less curl spam of junk rows).
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    // per-IP brake (10/min) — generous for humans, fatal for spam scripts
    if (await rateLimited(request, env, "lead", 10)) return json({ error: "too many requests" }, 429);
    const body = await request.json();
    // Honeypot: a hidden "website" field that real users never see/fill. If a bot fills it, pretend
    // success but DON'T store — keeps junk out of the lead store without tipping off the bot.
    if ((body.website || "").toString().trim()) return json({ ok: true, stored: false });
    const s = (v, n = 200) => (v == null ? "" : v.toString().slice(0, n));
    const lead = {
      name: s(body.name, 120),
      email: s(body.email, 160),
      phone: s(body.phone, 40),
      contact: s(body.contact || body.phone || body.email, 160),
      channel: s(body.channel, 40),
      business: s(body.business, 160),
      industry: s(body.industry, 80),
      message: s(body.message, 800),
      score: s(body.score, 12),
      leak: s(body.leak, 16),
      source: s(body.source || "website", 60),
      ref: s(body.ref, 40), // Growth Partner attribution (?ref= link) — drives Track-A commissions
      lang: s(body.lang, 5),
      at: new Date().toISOString(),
    };
    // need at least one way to reach them
    if (!lead.email && !lead.phone && !lead.contact) return json({ error: "Need a contact" }, 400);

    // human-readable detail line for the feed
    const bits = [];
    if (lead.industry) bits.push(lead.industry);
    if (lead.score) bits.push(`score ${lead.score}/100`);
    if (lead.leak) bits.push(`leak ${lead.leak}/mo`);
    if (lead.message) bits.push(lead.message);
    if (lead.ref) bits.push(`👤ref:${lead.ref}`);
    // 🌐lang tag — gui_actions has no lang column, so the lead's language rides inside `details`
    // (same encoding trick as 👤ref above). /api/lifecycle parses it back so the nurture drip
    // emails the lead in THEIR language. EN is the default → not stored (keeps the feed clean).
    const leadLang = (lead.lang || "").toLowerCase().slice(0, 2);
    if (["pt", "es", "hi"].includes(leadLang)) bits.push(`🌐lang:${leadLang}`);
    const details = bits.join(" · ");

    let stored = false;

    // 1) ALWAYS persist to the gui_actions store → shows on /admin + /live (Luis closes from there)
    const SB_URL = env.GUI_ACTIONS_SUPABASE_URL || "https://ynihodbknhjirkdogxby.supabase.co";
    const SB_ANON = env.GUI_ACTIONS_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
    try {
      const r = await fetch(`${SB_URL}/rest/v1/gui_actions`, {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ action: "lead", name: lead.name, contact: lead.contact || lead.email || lead.phone, details, business: lead.business, industry: lead.industry, source: lead.source }),
      });
      stored = r.ok;
    } catch { /* never fail the capture */ }

    // 1b) CRM SPINE — every website lead becomes a contact in Guileo's OWN CRM (dogfooding the Company OS).
    //     Best-effort + graceful: no-op until db/crm_spine.sql is pasted.
    if (env.SCHED_SECRET) {
      try {
        const cEmail = lead.email || (/.+@.+\..+/.test(lead.contact) ? lead.contact : "");
        const cPhone = (lead.phone || (/^\+?[0-9][0-9\s()\-]{6,}$/.test(lead.contact) ? lead.contact : "")).replace(/[^0-9+]/g, "");
        if (cEmail || cPhone) {
          await svcRpc(env, "crm_upsert_contact", { p_secret: env.SCHED_SECRET, p_email: (env.OWNER_EMAIL || "smart@guileoai.com"), p_phone: cPhone, p_contact_email: cEmail, p_name: lead.name || "", p_source: `web:${lead.source || "lead"}`, p_amount_cents: 0 });
        }
      } catch { /* CRM not live yet → never block the capture */ }
    }

    // 2) Optional: forward to a no-code webhook (email / Sheet / CRM)
    if (env.LEAD_WEBHOOK) {
      try { const r = await fetch(env.LEAD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) }); if (r.ok) stored = true; } catch { /* keep going */ }
    }
    // 3) Optional: dedicated Supabase `leads` table
    if (env.SUPABASE_URL && env.SUPABASE_KEY) {
      try { const r = await fetch(`${env.SUPABASE_URL}/rest/v1/leads`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(lead) }); if (r.ok) stored = true; } catch { /* keep going */ }
    }

    // 4) Email the owner instantly (works as soon as RESEND_API_KEY is set). Defaults to the
    //    Resend account email so it delivers even before guileoai.com is DNS-verified.
    if (env.RESEND_API_KEY) {
      const OWNER = env.OWNER_EMAIL || "smart@guileoai.com";
      const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
      const kind = lead.source === "configurator" ? "quote request" : lead.source === "portal-onboard" ? "new client signup" : "lead";
      // Branded owner alert (emailTemplates.js) — never ad-hoc HTML. Owner reads it → pt.
      const tpl = leadAlertEmail({ kind, name: lead.name, contact: lead.contact || lead.email || lead.phone, business: lead.business, industry: lead.industry, source: lead.source, ref: lead.ref, details: details || lead.message, lang: "pt" });
      try {
        const er = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: [OWNER], subject: tpl.subject, html: tpl.html }),
        });
        if (er.ok) stored = true; // a delivered owner email IS durable delivery — the lead reached Luis
      } catch { /* never block the capture */ }
    }

    // 5) COMPLIANCE: log TCPA consent for this lead (proof against fines). The form sends
    //    consent=true; we record the phone/email + the consent text + source.
    const INGEST = env.INGEST_SECRET || "";
    const leadPhone = (lead.phone || (/^\+?[0-9][0-9\s()\-]{6,}$/.test(lead.contact) ? lead.contact : "")).replace(/[^0-9+]/g, "");
    if (INGEST && (leadPhone || lead.email)) {
      try {
        await fetch(`${SB_URL}/rest/v1/rpc/log_consent`, {
          method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: INGEST, p_phone: leadPhone, p_email: lead.email, p_source: lead.source, p_text: body.consent === false ? "NO_CONSENT" : "agreed to be contacted by Gui (call/text), STOP to opt out" }),
        });
      } catch { /* never block capture */ }
    }

    // 6) SPEED-TO-LEAD: be the first to respond. If this lead has a phone, consented, and is
    //    NOT on the do-not-contact list, fire Gui to CALL them within seconds. 78% buy from
    //    whoever answers first. Guarded so it never blocks or double-fails the capture.
    // 4b) INSTANT REPLY to the PROSPECT — speed-to-lead first touch, via the brand email template.
    //     callNow lets the configurator opt the lead into an immediate Gui call (consented checkbox).
    const callConsented = body.consent !== false;
    // ANTI-ABUSE per-PHONE cooldown: a number is auto-called at most once / 12h, no matter how many
    // times this (Origin-spoofable) endpoint is hit — stops harassment + runaway cost of an attacker
    // posting a victim's number with callNow. call.js's fail-closed per-IP daily cap backstops KV outages.
    // READ-ONLY here: only check the cooldown to gate eligibility. We WRITE it later, but solely when
    // we actually dial — so a non-call lead (noCall/no-consent/configurator) never burns a real lead's
    // 12h window. (Earlier this wrote on every lead, silently blocking a later legit speed-to-lead call.)
    let phoneCooled = false;
    if (env.RATE_LIMIT && leadPhone) {
      try { if (await env.RATE_LIMIT.get(`callph:${leadPhone}`)) phoneCooled = true; }
      catch { /* KV down → call.js fail-closed caps still apply, never block capture */ }
    }
    // noCall:true → caller already triggers /api/call itself (LiveCall, LiveCallBar). Skip the
    // server-side speed-to-lead trigger so the prospect is never dialed twice (one ring, one cost).
    const callEligible = !!(env.ELEVENLABS_API_KEY && env.ELEVENLABS_PHONE_NUMBER_ID && leadPhone && callConsented && !phoneCooled && body.noCall !== true && (lead.source !== "configurator" || body.callNow === true));
    if (env.RESEND_API_KEY && lead.email) {
      try {
        // CONTACT INSTRUMENT: this email exists to get a reply. So it comes from a HUMAN, replyable
        // address (never noreply@ — that kills replies + hurts inbox placement), with Reply-To pointed
        // at a monitored inbox. Every reply also trains Gmail to inbox our future mail.
        const FROM = env.EMAIL_FROM_CONTACT || "Gui · Guileo <gui@guileoai.com>";
        const REPLY_TO = env.EMAIL_REPLY_TO || "smart@guileoai.com";
        // normalized 2-letter lang ("pt-BR" → "pt") — raw 5-char values missed the template map
        // and silently fell back to EN. hi → en by design (no Hindi email templates).
        const mail = leadReceivedEmail({ name: lead.name || "there", business: lead.business, lang: ["pt", "es"].includes(leadLang) ? leadLang : "en", callNow: callEligible, leak: lead.leak, industry: lead.industry });
        await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [lead.email], subject: mail.subject, html: mail.html }),
        });
      } catch { /* never block the capture */ }
    }

    let calling = false;
    if (callEligible) {
      try {
        // BRAKE 2/3 — explicit GLOBAL daily cap on auto-calls (intentional cost/abuse ceiling, independent
        // of the per-IP limiter which the internal fetch bypasses). 50/day is generous for real leads.
        let capHit = false;
        if (env.RATE_LIMIT) {
          try {
            const dk = `callday:${new Date().toISOString().slice(0, 10)}`;
            const n = parseInt((await env.RATE_LIMIT.get(dk)) || "0", 10);
            if (n >= 150) capHit = true;
            else await env.RATE_LIMIT.put(dk, String(n + 1), { expirationTtl: 172800 });
          } catch { /* KV down → call.js fail-closed caps backstop */ }
        }
        // respect TCPA opt-out (skipped if the global cap already blocked this call)
        let blocked = capHit;
        if (!blocked && INGEST) {
          const dr = await fetch(`${SB_URL}/rest/v1/rpc/is_dnc`, { method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_secret: INGEST, p_phone: leadPhone }) });
          if (dr.ok) blocked = (await dr.json()) === true; // tighten: only a literal true blocks
        }
        if (!blocked) {
          const origin = new URL(request.url).origin;
          // commit the 12h per-phone cooldown ONLY now that we're truly dialing (not on every lead).
          if (env.RATE_LIMIT) { try { await env.RATE_LIMIT.put(`callph:${leadPhone}`, "1", { expirationTtl: 43200 }); } catch { /* KV down → daily/IP caps backstop */ } }
          // Internal server-to-server dial: carry the shared DIGEST_TOKEN so call.js SKIPS the per-IP
          // cap (this fetch comes from our own edge, not the lead's browser) while keeping every
          // per-phone / global / DNC guard. Check res.ok — a failed dial must be visible, not silent.
          const cr = await fetch(`${origin}/api/call`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: origin, "x-guileo-internal": env.DIGEST_TOKEN || "" },
            body: JSON.stringify({ phone: leadPhone, name: lead.name, business: lead.business, industry: lead.industry, need: lead.message || details, lang: lead.lang || "auto" }),
          });
          if (cr.ok) { calling = true; }
          else { calling = false; await emitFailure(env, "speed_to_lead_failed", leadPhone, `internal /api/call returned HTTP ${cr.status} — first-touch call NOT placed`, { phone: leadPhone, source: lead.source }); }
        }
      } catch { /* speed-to-lead is best-effort, never block */ }
    }

    return json({ ok: true, stored, calling });
  } catch {
    return json({ error: "bad request" }, 400);
  }
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
