var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/agent-action.js
async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const provided = request.headers.get("x-guileo-secret") || new URL(request.url).searchParams.get("secret") || "";
    if (!env.AGENT_ACTION_SECRET || provided !== env.AGENT_ACTION_SECRET) return json({ error: "unauthorized" }, 401);
    const b = await request.json();
    const s = /* @__PURE__ */ __name((v, n = 200) => v == null ? "" : v.toString().slice(0, n), "s");
    const action = s(b.action || "lead", 40);
    const rec = {
      action,
      name: s(b.name, 120),
      contact: s(b.contact || b.phone || b.email, 160),
      when: s(b.when || b.datetime, 120),
      details: s(b.details || b.need || b.message, 500),
      business: s(b.business, 160),
      industry: s(b.industry, 80),
      amount: s(b.amount, 40),
      source: "gui-call",
      at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const SB_URL = env.GUI_ACTIONS_SUPABASE_URL || "https://fccwbafkbhkyrvauzshl.supabase.co";
    const SB_ANON = env.GUI_ACTIONS_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjY3diYWZrYmhreXJ2YXV6c2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTU3NzQsImV4cCI6MjA5NDI5MTc3NH0.knDpHzK_cfpqmUzpLI4rTndAumn1yepCiRwCSAqwSNs";
    let stored = false;
    try {
      const r = await fetch(`${SB_URL}/rest/v1/gui_actions`, {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ action: rec.action, name: rec.name, contact: rec.contact, slot: rec.when, details: rec.details, business: rec.business, industry: rec.industry, amount: rec.amount, source: rec.source })
      });
      stored = r.ok;
    } catch {
    }
    let delivered = false;
    if (env.LEAD_WEBHOOK) {
      try {
        const r = await fetch(env.LEAD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec) });
        delivered = r.ok;
      } catch {
      }
    }
    const who = rec.name || "you";
    const amt = rec.amount ? `$${rec.amount}` : "";
    const msg = {
      book: `All set \u2014 booked for ${who}${rec.when ? ` on ${rec.when}` : ""}. You'll get a confirmation. Anything else?`,
      reschedule: `Done \u2014 moved ${who}'s booking${rec.when ? ` to ${rec.when}` : ""}.`,
      cancel: `Cancelled ${who}'s booking \u2014 no worries.`,
      order: `Order placed for ${who}${amt ? ` (${amt})` : ""} \u2014 I'll send a confirmation.`,
      sale: `Sale logged${amt ? ` for ${amt}` : ""} \u2014 thank you, ${who}!`,
      invoice: `I've sent ${who} a secure payment link${amt ? ` for ${amt}` : ""} \u2014 you can pay whenever you're ready.`,
      quote: `I've captured your quote request, ${who} \u2014 you'll have it shortly.`,
      lead: `Got it, ${who}. I've saved your details and the team will follow up.`,
      qualify: `Thanks, ${who} \u2014 noted what you need; we'll match you to the right option.`,
      callback: `Perfect \u2014 I've scheduled a callback for ${who}${rec.when ? ` ${rec.when}` : ""}.`,
      review: `Thanks! I've sent ${who} a review request.`,
      confirm: `Confirmation sent to ${who}.`,
      message: `Message noted \u2014 ${who} will hear from us shortly.`,
      winback: `Welcome back, ${who}! I've set up a special offer for you.`,
      noshow: `No problem \u2014 I've rebooked ${who}${rec.when ? ` for ${rec.when}` : ""} and freed your old slot.`,
      info: `Noted your question, ${who} \u2014 someone will get you the exact answer.`
    }[action] || `Done \u2014 ${action} captured for ${who}.`;
    return json({ ok: true, stored, delivered, message: msg, record: rec });
  } catch {
    return json({ ok: false, message: "Sorry, I couldn't save that just now \u2014 could you repeat it?" }, 400);
  }
}
__name(onRequestPost, "onRequestPost");
var json = /* @__PURE__ */ __name((obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } }), "json");

// lib/guard.js
var ALLOWED_ORIGINS = ["https://guileoai.com", "https://www.guileoai.com"];
var okOrigin = /* @__PURE__ */ __name((u) => ALLOWED_ORIGINS.includes(u) || /^https:\/\/[a-z0-9-]+\.guileoai\.pages\.dev$/.test(u), "okOrigin");
function sameOrigin(request) {
  const o = request.headers.get("Origin") || "";
  if (o) return okOrigin(o);
  const ref = request.headers.get("Referer") || "";
  if (ref) {
    try {
      return okOrigin(new URL(ref).origin);
    } catch {
      return false;
    }
  }
  return false;
}
__name(sameOrigin, "sameOrigin");
function ownerEmails(env) {
  const set = /* @__PURE__ */ new Set(["smart@guileoai.com", "luistelesc@gmail.com"]);
  if (env && env.OWNER_EMAIL) env.OWNER_EMAIL.split(",").forEach((e) => set.add(e.trim().toLowerCase()));
  return set;
}
__name(ownerEmails, "ownerEmails");
function isOwnerEmail(to, env) {
  return ownerEmails(env).has((to || "").trim().toLowerCase());
}
__name(isOwnerEmail, "isOwnerEmail");

// api/call.js
var ELEVEN_AGENT_ID = "agent_5901ktdkev68f5kb161fmeax1rdm";
async function onRequestPost2(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json2({ error: "forbidden" }, 403);
    const body = await request.json();
    const phone = (body.phone || "").toString().trim();
    if (!phone) return json2({ error: "Missing phone" }, 400);
    if (!/^\+?[1-9]\d{7,14}$/.test(phone.replace(/[\s()-]/g, ""))) return json2({ error: "Invalid phone" }, 400);
    const vars = {
      name: (body.name || "").toString().slice(0, 120),
      business: (body.business || "").toString().slice(0, 160),
      industry: (body.industry || "").toString().slice(0, 80),
      need: (body.need || "").toString().slice(0, 300),
      lang: (body.lang || "auto").toString().slice(0, 8)
    };
    if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_PHONE_NUMBER_ID) {
      const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
        method: "POST",
        headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: env.ELEVENLABS_AGENT_ID || ELEVEN_AGENT_ID,
          agent_phone_number_id: env.ELEVENLABS_PHONE_NUMBER_ID,
          to_number: phone,
          conversation_initiation_client_data: { dynamic_variables: vars }
        })
      });
      if (!res.ok) {
        try {
          console.log("call provider error", (await res.text()).slice(0, 300));
        } catch {
        }
        return json2({ error: "call provider error" }, 502);
      }
      return json2({ ok: true, provider: "elevenlabs" });
    }
    if (env.VAPI_API_KEY && env.VAPI_ASSISTANT_ID && env.VAPI_PHONE_NUMBER_ID) {
      const res = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.VAPI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId: env.VAPI_ASSISTANT_ID,
          phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
          customer: { number: phone, name: vars.name || void 0 },
          assistantOverrides: { variableValues: vars }
        })
      });
      if (!res.ok) return json2({ error: "call provider error" }, 502);
      return json2({ ok: true, provider: "vapi" });
    }
    return json2({ error: "Outbound calling not configured yet" }, 501);
  } catch {
    return json2({ error: "bad request" }, 400);
  }
}
__name(onRequestPost2, "onRequestPost");
var json2 = /* @__PURE__ */ __name((obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } }), "json");

// api/email.js
async function onRequestPost3(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const to = (body.to || "").toString().trim();
    const subject = (body.subject || "Guileo").toString().slice(0, 200);
    const html = (body.html || body.text || "").toString();
    const text = (body.text || "").toString();
    if (!to || !html) return json3({ ok: false, reason: "need to + html" }, 400);
    if (!isOwnerEmail(to, env)) return json3({ ok: false, reason: "recipient not allowed" }, 403);
    const KEY = env.RESEND_API_KEY;
    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    if (!KEY) return json3({ ok: false, reason: "no key" });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, ...text ? { text } : {} })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json3({ ok: false, error: data?.message || data?.name || `HTTP ${r.status}`, from: FROM }, 200);
    return json3({ ok: true, id: data?.id || null });
  } catch (e) {
    return json3({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
__name(onRequestPost3, "onRequestPost");
function json3(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}
__name(json3, "json");
async function onRequestOptions() {
  return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
__name(onRequestOptions, "onRequestOptions");

// api/lead.js
async function onRequestPost4(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json4({ error: "forbidden" }, 403);
    const body = await request.json();
    if ((body.website || "").toString().trim()) return json4({ ok: true, stored: false });
    const s = /* @__PURE__ */ __name((v, n = 200) => v == null ? "" : v.toString().slice(0, n), "s");
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
      lang: s(body.lang, 5),
      at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!lead.email && !lead.phone && !lead.contact) return json4({ error: "Need a contact" }, 400);
    const bits = [];
    if (lead.industry) bits.push(lead.industry);
    if (lead.score) bits.push(`score ${lead.score}/100`);
    if (lead.leak) bits.push(`leak ${lead.leak}/mo`);
    if (lead.message) bits.push(lead.message);
    const details = bits.join(" \xB7 ");
    let stored = false;
    const SB_URL = env.GUI_ACTIONS_SUPABASE_URL || "https://fccwbafkbhkyrvauzshl.supabase.co";
    const SB_ANON = env.GUI_ACTIONS_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjY3diYWZrYmhreXJ2YXV6c2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTU3NzQsImV4cCI6MjA5NDI5MTc3NH0.knDpHzK_cfpqmUzpLI4rTndAumn1yepCiRwCSAqwSNs";
    try {
      const r = await fetch(`${SB_URL}/rest/v1/gui_actions`, {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ action: "lead", name: lead.name, contact: lead.contact || lead.email || lead.phone, details, business: lead.business, industry: lead.industry, source: lead.source })
      });
      stored = r.ok;
    } catch {
    }
    if (env.LEAD_WEBHOOK) {
      try {
        const r = await fetch(env.LEAD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
        if (r.ok) stored = true;
      } catch {
      }
    }
    if (env.SUPABASE_URL && env.SUPABASE_KEY) {
      try {
        const r = await fetch(`${env.SUPABASE_URL}/rest/v1/leads`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(lead) });
        if (r.ok) stored = true;
      } catch {
      }
    }
    if (env.RESEND_API_KEY) {
      const OWNER = env.OWNER_EMAIL || "smart@guileoai.com";
      const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
      const kind = lead.source === "configurator" ? "quote request" : lead.source === "portal-onboard" ? "new client signup" : "lead";
      const rows = [
        ["Name", lead.name],
        ["Contact", lead.contact || lead.email || lead.phone],
        ["Business", lead.business],
        ["Industry", lead.industry],
        ["Source", lead.source],
        ["Details", details || lead.message]
      ].filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#888">${k}</td><td style="padding:4px 0;font-weight:600">${String(v).replace(/</g, "&lt;")}</td></tr>`).join("");
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: [OWNER], subject: `\u{1F331} New ${kind}: ${lead.name}`, html: `<div style="font-family:system-ui,sans-serif;max-width:520px"><h2 style="color:#3E9468;margin:0 0 4px">New ${kind}</h2><p style="color:#888;margin:0 0 14px">via guileoai.com</p><table style="font-size:14px">${rows}</table><p style="margin-top:18px"><a href="https://www.guileoai.com/admin" style="color:#3E9468;font-weight:700">Open /admin \u2192</a></p></div>` })
        });
      } catch {
      }
    }
    return json4({ ok: true, stored });
  } catch {
    return json4({ error: "bad request" }, 400);
  }
}
__name(onRequestPost4, "onRequestPost");
var json4 = /* @__PURE__ */ __name((obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } }), "json");

// lib/emailTemplates.js
var B = {
  logo: "https://guileoai.com/favicon.png",
  anim: "https://guileoai.com/email/guileo-header.gif",
  // animated header banner (silver sweep)
  site: "https://guileoai.com",
  portal: "https://guileoai.com/portal",
  // graphite / cement surfaces — card lifted a touch lighter than the page for contrast ("tchan")
  bg: "#0c0b09",
  card: "#1a1812",
  panel: "#221f17",
  panel2: "#2a261c",
  line: "#332f25",
  edge: "rgba(255,255,255,0.06)",
  // glass top-edge highlight
  // text
  ink: "#f3efe6",
  // ivory
  ink2: "#cdc7ba",
  muted: "#8f8a7e",
  faint: "#5f5b51",
  // accents
  gold: "#d8c79b",
  // champagne — premium highlight
  goldDim: "#b9a878",
  green: "#5a8f6f"
  // muted graphite-green — DETAIL ONLY
};
var esc = /* @__PURE__ */ __name((s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]), "esc");
var HEAD_STYLE = `
  <style>
    /* Inter \u2014 the site's exact typeface. Honored by Apple Mail & co; Gmail falls back to the
       SF/Segoe stack (closest metrics). This is what makes the lettering match the site. */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    /* base reset */
    body,table,td,a{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    img{ -ms-interpolation-mode:bicubic; }
    a{ text-decoration:none; }
    @media (max-width:600px){
      .g-shell{ padding:22px 12px !important; }
      .g-card{ border-radius:18px !important; }
      .g-pad{ padding-left:22px !important; padding-right:22px !important; }
      .g-pad-head{ padding-left:22px !important; padding-right:22px !important; }
      .g-h1{ font-size:23px !important; line-height:1.24 !important; }
      .g-h1-sm{ font-size:22px !important; }
      .g-intro{ font-size:14.5px !important; }
      /* primary CTA goes full-width + comfortable tap target */
      .g-btn-wrap{ width:100% !important; }
      .g-btn{ display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; padding:16px 18px !important; font-size:15px !important; }
      .g-btn2{ display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
      /* stat row stays in one line but breathes less */
      .g-stat{ padding:12px 2px !important; }
      .g-statnum{ font-size:26px !important; }
      /* lead card meta: let channel wrap under the name instead of overflowing */
      .g-lead-chan{ font-size:10.5px !important; }
    }
    @media (prefers-color-scheme: light){
      /* keep it dark \u2014 this is an intentionally dark "screen" */
      body{ background:${B.bg} !important; }
    }
  </style>`;
function shell({ preheader = "", eyebrow = "", body = "" }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">${HEAD_STYLE}</head>
<body style="margin:0;padding:0;background:${B.bg};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${B.bg};font-size:1px;line-height:1px;">${preheader}&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="g-shell" style="background:${B.bg};background-image:radial-gradient(820px 360px at 50% -80px, #18160f 0%, #0e0d0a 52%, ${B.bg} 78%);padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="g-card" style="max-width:600px;width:100%;background:${B.card};background-image:linear-gradient(180deg,#15140f 0%,${B.card} 30%);border:1px solid ${B.line};border-radius:22px;overflow:hidden;box-shadow:0 40px 100px -45px rgba(0,0,0,0.92),0 2px 0 rgba(255,255,255,0.02);">
<!-- glass top edge + champagne hairline (fine inset light lines) -->
<tr><td style="height:1px;background:${B.edge};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="height:2px;background:linear-gradient(90deg,transparent,${B.goldDim} 34%,${B.gold} 50%,${B.goldDim} 66%,transparent);font-size:0;line-height:0;">&nbsp;</td></tr>
<!-- ANIMATED header banner (silver light-sweep + logo + brand) \u2014 GIF works in Gmail/Apple/Outlook -->
<tr><td style="font-size:0;line-height:0;background:#100f0b;" align="center">
  <a href="${B.site}" style="text-decoration:none;display:block;"><img src="${B.anim}" width="600" alt="Guileo \u2014 AI Systems for Business" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" /></a>
</td></tr>
${eyebrow ? `<tr><td class="g-pad-head" style="padding:20px 40px 0 40px;background:${B.card};" align="center">
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${B.gold};">${eyebrow}</div>
</td></tr>` : ""}
<tr><td class="g-pad" style="padding:14px 40px 36px 40px;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;">${body}</td></tr>
<!-- footer -->
<tr><td class="g-pad" style="padding:22px 40px 30px 40px;border-top:1px solid ${B.line};background:#100f0b;" align="center">
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};line-height:1.85;">
    <span style="color:${B.green};font-size:9px;vertical-align:middle;">\u25CF</span>&nbsp; <span style="color:${B.ink2};font-weight:600;">Guileo</span> \u2014 AI Systems for Business<br/>
    <a href="${B.site}" style="color:${B.gold};text-decoration:none;">guileoai.com</a>
    <span style="color:${B.faint};">&nbsp;\xB7&nbsp;</span>Work smart. Grow faster. Sleep better.
  </div>
</td></tr>
</table>
<div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;color:${B.faint};margin-top:18px;">You're receiving this because you started with Guileo.</div>
</td></tr>
</table>
</body></html>`;
}
__name(shell, "shell");
function cta(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="g-btn-wrap" style="margin:6px auto 0 auto;"><tr>
  <td align="center" style="border-radius:999px;background:linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%);box-shadow:0 16px 42px -12px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.85),inset 0 -1px 0 rgba(0,0,0,0.12),0 0 0 1px rgba(255,255,255,0.35);">
    <a href="${href}" class="g-btn" style="display:inline-block;padding:15px 34px;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;font-weight:800;letter-spacing:.2px;color:#1a1813;text-decoration:none;border-radius:999px;text-shadow:0 1px 0 rgba(255,255,255,0.45);">${label}</a>
  </td></tr></table>`;
}
__name(cta, "cta");
function cta2(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
  <td align="center" style="border-radius:999px;background:linear-gradient(180deg,rgba(216,199,155,0.16) 0%,rgba(185,168,120,0.10) 100%);border:1px solid rgba(216,199,155,0.40);box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);">
    <a href="${href}" class="g-btn2" style="display:inline-block;padding:11px 24px;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.2px;color:${B.gold};text-decoration:none;border-radius:999px;">${label}</a>
  </td></tr></table>`;
}
__name(cta2, "cta2");
function panel(inner, pad = "18px 20px") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${B.panel};background-image:linear-gradient(180deg,#1f1d18 0%,${B.panel} 60%);border:1px solid ${B.line};border-radius:16px;box-shadow:inset 0 1px 0 ${B.edge},0 18px 40px -30px rgba(0,0,0,0.8);">
    <tr><td style="padding:${pad};">${inner}</td></tr></table>`;
}
__name(panel, "panel");
var H1W = { "welcome-pt": 522, "welcome-en": 502, "digest-pt": 496, "digest-en": 370, "proposal-pt": 475, "proposal-en": 357, "proof-pt": 450, "proof-en": 520, "reengage-pt": 420, "reengage-en": 443, "links-pt": 371, "links-en": 266 };
function h1img(key, lang, alt, sub = "") {
  const k = `${key}-${lang === "pt" ? "pt" : "en"}`;
  return `<img src="${B.site}/email/h1-${k}.png" width="${Math.min(H1W[k] || 460, 520)}" alt="${esc(alt)}" style="display:block;max-width:100%;height:auto;border:0;" />` + (sub ? `<div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:800;letter-spacing:.2px;color:${B.gold};margin-top:10px;">${sub}</div>` : "");
}
__name(h1img, "h1img");
function welcomeEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name);
  business = esc(business);
  const t = lang === "pt" ? {
    subject: `Bem-vindo \xE0 Guileo, ${name} \u{1F331}`,
    pre: `O Gui est\xE1 configurado para ${business}. Veja como come\xE7ar.`,
    eyebrow: "Seu sistema de crescimento est\xE1 no ar",
    h1: `Bem-vindo \xE0 Guileo, ${name}`,
    intro: `O Gui \u2014 seu sistema de crescimento com IA \u2014 j\xE1 est\xE1 configurado para <span style="color:${B.ink};font-weight:600;">${business}</span>. A partir de hoje ele atende liga\xE7\xF5es, captura leads, agenda, faz follow-up e vende \u2014 <span style="color:${B.gold};font-weight:700;">o tempo todo</span>, enquanto voc\xEA toca o neg\xF3cio.`,
    stepsTitle: "Seus 3 primeiros passos",
    steps: [
      ["Conecte suas ferramentas", "Agenda, WhatsApp, Stripe, seu PDV \u2014 o Gui se integra ao que voc\xEA j\xE1 usa."],
      ["Deixe o Gui na recep\xE7\xE3o", "Ele atende toda liga\xE7\xE3o &amp; mensagem, qualifica cada lead, e n\xE3o deixa nenhum escapar."],
      ["Veja o crescimento", "Resumos di\xE1rios chegam no seu email \u2014 exatamente o que o Gui recuperou e agendou."]
    ],
    cta: "Abrir meu painel \u{1F680}",
    cta2: "Conectar uma ferramenta \u{1F50C}",
    foot: "D\xFAvidas? \xC9 s\xF3 responder \u2014 um humano de verdade l\xEA cada mensagem."
  } : {
    subject: `Welcome to Guileo, ${name} \u{1F331}`,
    pre: `Gui is set up for ${business}. Here's how to start.`,
    eyebrow: "Your growth system is live",
    h1: `Welcome to Guileo, ${name}`,
    intro: `Gui \u2014 your AI growth system \u2014 is set up for <span style="color:${B.ink};font-weight:600;">${business}</span>. From today it answers calls, captures leads, books, follows up and sells \u2014 <span style="color:${B.gold};font-weight:700;">around the clock</span>, while you run the business.`,
    stepsTitle: "Your first 3 steps",
    steps: [
      ["Connect your tools", "Calendar, WhatsApp, Stripe, your POS \u2014 Gui plugs into the stack you already use."],
      ["Let Gui run the front desk", "It answers every call &amp; message, qualifies each lead, and never lets one slip."],
      ["Watch the growth", "Daily summaries land in your inbox \u2014 exactly what Gui recovered and booked."]
    ],
    cta: "Open my dashboard \u{1F680}",
    cta2: "Connect a tool \u{1F50C}",
    foot: "Questions? Just reply \u2014 a real human reads every message."
  };
  const step = /* @__PURE__ */ __name((n, title, desc) => `<tr><td style="padding:9px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="42" valign="top">
        <div style="width:32px;height:32px;border-radius:10px;background:radial-gradient(120% 120% at 50% 0%, #2a2620 0%, ${B.panel2} 100%);border:1px solid ${B.line};box-shadow:inset 0 1px 0 ${B.edge};color:${B.gold};font-weight:800;font-size:13px;text-align:center;line-height:32px;font-family:'Segoe UI',Arial,sans-serif;">${n}</div>
      </td>
      <td valign="top" style="font-family:'Segoe UI',Arial,sans-serif;padding-left:4px;">
        <div style="font-size:15px;font-weight:700;color:${B.ink};letter-spacing:.1px;">${title}</div>
        <div style="font-size:13px;color:${B.muted};line-height:1.65;margin-top:3px;">${desc}</div>
      </td></tr></table></td></tr>`, "step");
  const body = `
  ${h1img("welcome", lang, t.h1, esc(name) + " \u{1F331}")}
  <div class="g-intro" style="font-size:15px;color:${B.ink2};line-height:1.72;margin-top:13px;">${t.intro}</div>
  <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};font-family:'Segoe UI',Arial,sans-serif;margin-bottom:6px;">${t.stepsTitle}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${t.steps.map((s, i) => step(i + 1, s[0], s[1])).join("")}
    </table>`)}
  <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.portal)}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.portal)}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body }) };
}
__name(welcomeEmail, "welcomeEmail");
function dailyLeadsEmail({ name = "there", dateLabel = "Today", leads = [], lang = "en" } = {}) {
  name = esc(name);
  dateLabel = esc(dateLabel);
  leads = (Array.isArray(leads) ? leads : []).map((l) => ({ heat: l.heat, name: esc(l.name), channel: esc(l.channel), want: esc(l.want), action: esc(l.action) }));
  const t = lang === "pt" ? {
    eyebrow: "Resumo de leads do dia",
    h1: "Seus leads",
    intro1: `Bom dia ${name} \u2014 aqui est\xE1 quem o Gui capturou e qualificou enquanto voc\xEA estava ocupado.`,
    intro2: "Nada escapou.",
    sNew: "Novos leads",
    sHot: "Quentes",
    sDone: "Respondidos",
    cta: "Ver todos os leads \u2192",
    cta2: "Abrir painel \u{1F680}",
    foot: "O Gui j\xE1 ligou ou respondeu cada um. Voc\xEA s\xF3 fecha.",
    subj: /* @__PURE__ */ __name((tt, hh) => `${tt} leads novos hoje \u2014 ${hh} quentes \xB7 Guileo`, "subj"),
    pre: /* @__PURE__ */ __name((tt, hh) => `${tt} leads capturados, ${hh} quentes. O Gui respondeu todos.`, "pre"),
    heat: { hot: "Quente", warm: "Morno", new: "Novo" }
  } : {
    eyebrow: "Daily lead digest",
    h1: "Your leads",
    intro1: `Morning ${name} \u2014 here's everyone Gui captured and qualified while you were busy.`,
    intro2: "Nothing slipped.",
    sNew: "New leads",
    sHot: "Hot",
    sDone: "Followed up",
    cta: "See all leads \u2192",
    cta2: "Open dashboard \u{1F680}",
    foot: "Gui already called or messaged each one back. You just close them.",
    subj: /* @__PURE__ */ __name((tt, hh) => `${tt} new leads today \u2014 ${hh} hot \xB7 Guileo`, "subj"),
    pre: /* @__PURE__ */ __name((tt, hh) => `${tt} leads captured, ${hh} hot. Gui followed up with all of them.`, "pre"),
    heat: { hot: "Hot", warm: "Warm", new: "New" }
  };
  const heat = { hot: { c: "#d98a63", l: t.heat.hot }, warm: { c: B.gold, l: t.heat.warm }, new: { c: "#7fa6ad", l: t.heat.new } };
  const total = leads.length;
  const hot = leads.filter((l) => l.heat === "hot").length;
  const stat = /* @__PURE__ */ __name((n, label, color) => `<td align="center" width="33%" class="g-stat" style="padding:14px 4px;">
    <div class="g-statnum" style="font-size:30px;font-weight:800;color:${color};font-family:'Segoe UI',Arial,sans-serif;letter-spacing:-.5px;text-shadow:0 1px 0 rgba(0,0,0,0.4);">${n}</div>
    <div style="font-size:10px;color:${B.muted};text-transform:uppercase;letter-spacing:1.5px;font-family:'Segoe UI',Arial,sans-serif;margin-top:2px;">${label}</div></td>`, "stat");
  const leadCard = /* @__PURE__ */ __name((l) => {
    const h = heat[l.heat] || heat.new;
    return `<tr><td style="padding:5px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${B.panel};background-image:linear-gradient(180deg,#1f1d18 0%,${B.panel} 65%);border:1px solid ${B.line};border-radius:14px;box-shadow:inset 0 1px 0 ${B.edge},0 16px 36px -30px rgba(0,0,0,0.8);">
        <tr><td style="padding:15px 17px;font-family:'Segoe UI',Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle">
              <span style="font-size:15px;font-weight:700;color:${B.ink};letter-spacing:.1px;">${l.name}</span>
              <span style="display:inline-block;margin-left:9px;font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${h.c};border:1px solid ${h.c}40;background:${h.c}14;border-radius:999px;padding:2px 9px;vertical-align:middle;">${h.l}</span>
            </td>
            <td align="right" valign="middle" class="g-lead-chan" style="font-size:11px;color:${B.muted};white-space:nowrap;">${l.channel}</td>
          </tr></table>
          <div style="font-size:13px;color:${B.ink2};line-height:1.6;margin-top:8px;">${l.want}</div>
          <div style="font-size:12px;color:${B.muted};margin-top:9px;padding-top:9px;border-top:1px solid ${B.line};">
            <span style="color:${B.green};font-weight:700;">\u2713</span> <span style="color:${B.ink2};">${l.action}</span>
          </div>
        </td></tr>
      </table></td></tr>`;
  }, "leadCard");
  const body = `
  ${h1img("digest", lang, `${t.h1} \u2014 ${dateLabel}`, esc(dateLabel))}
  <div class="g-intro" style="font-size:14px;color:${B.ink2};line-height:1.65;margin-top:9px;">${t.intro1} <span style="color:${B.ink};">${t.intro2}</span></div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${B.panel};background-image:linear-gradient(180deg,#1f1d18 0%,${B.panel} 60%);border:1px solid ${B.line};border-radius:16px;box-shadow:inset 0 1px 0 ${B.edge},0 18px 40px -30px rgba(0,0,0,0.8);"><tr>
    ${stat(total, t.sNew, B.ink)}
    <td width="1" style="background:${B.line};">&nbsp;</td>
    ${stat(hot, t.sHot, "#d98a63")}
    <td width="1" style="background:${B.line};">&nbsp;</td>
    ${stat("100%", t.sDone, B.gold)}
  </tr></table>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${leads.map(leadCard).join("")}
  </table>
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.portal)}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.portal)}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;"><span style="color:${B.green};">\u25CF</span> ${t.foot}</div>`;
  return { subject: t.subj(total, hot), html: shell({ preheader: t.pre(total, hot), eyebrow: t.eyebrow, body }) };
}
__name(dailyLeadsEmail, "dailyLeadsEmail");
function proposalEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name);
  business = esc(business);
  const t = lang === "pt" ? {
    subject: `${name}, o que a Guileo pode fazer por ${business} \u{1F331}`,
    pre: `Atendimento IA, an\xFAncios, conte\xFAdo, site, automa\xE7\xE3o \u2014 ideias prontas pra ${business}.`,
    eyebrow: "Proposta \xB7 feito pra voc\xEA",
    h1: `Ideias pra crescer ${business}`,
    intro: `Ol\xE1 ${name} \u2014 a Guileo \xE9 o sistema de IA que cuida do <span style="color:${B.ink};font-weight:600;">atendimento, do marketing e do operacional</span> do seu neg\xF3cio. Aqui est\xE1 o que a gente faz e algumas ideias pra come\xE7ar.`,
    servicesTitle: "O que fazemos por voc\xEA",
    services: [
      ["\u{1F4DE}", "Atendimento com IA 24/7", "Nunca perde uma liga\xE7\xE3o ou lead \u2014 atende, qualifica e agenda sozinho."],
      ["\u{1F4AC}", "WhatsApp & SMS autom\xE1tico", "Responde, vende e faz follow-up sem voc\xEA levantar um dedo."],
      ["\u{1F4E3}", "An\xFAncios & marketing", "Tr\xE1fego que vira cliente \u2014 campanhas gerenciadas pra voc\xEA."],
      ["\u{1F3AC}", "V\xEDdeo & conte\xFAdo", "Produ\xE7\xE3o que engaja e posiciona sua marca."],
      ["\u{1F4F1}", "Gest\xE3o de redes sociais", "Presen\xE7a que cresce no autom\xE1tico, no seu tom."],
      ["\u{1F310}", "Site, app & software", "Constru\xEDmos sob medida, do zero \u2014 r\xE1pido e bonito."],
      ["\u{1F916}", "Automa\xE7\xE3o com IA", "O trabalho repetitivo no piloto autom\xE1tico."],
      ["\u2B50", "Reviews & reputa\xE7\xE3o", "Mais 5 estrelas, mais confian\xE7a, mais vendas."]
    ],
    ideasTitle: "3 ideias pra come\xE7ar j\xE1",
    ideas: [
      "Recuperar liga\xE7\xF5es perdidas \u2192 cada chamada n\xE3o atendida vira agendamento.",
      "Transformar seguidores em clientes \u2192 conte\xFAdo + an\xFAncios que convertem.",
      "Tirar o operacional das suas costas \u2192 a IA cuida do repetitivo 24/7."
    ],
    cta: "Quero minha proposta \u2192",
    cta2: "Ver tudo que fazemos \u2192",
    foot: "Responda este email com o seu neg\xF3cio \u2014 montamos uma proposta sob medida pra voc\xEA."
  } : {
    subject: `${name}, what Guileo can do for ${business} \u{1F331}`,
    pre: `AI front desk, ads, content, website, automation \u2014 ready ideas for ${business}.`,
    eyebrow: "Proposal \xB7 built for you",
    h1: `Ideas to grow ${business}`,
    intro: `Hi ${name} \u2014 Guileo is the AI system that runs your <span style="color:${B.ink};font-weight:600;">front desk, marketing and operations</span>. Here's what we do and a few ideas to start with.`,
    servicesTitle: "What we do for you",
    services: [
      ["\u{1F4DE}", "24/7 AI front desk", "Never miss a call or lead \u2014 answers, qualifies and books on its own."],
      ["\u{1F4AC}", "WhatsApp & SMS, automated", "Replies, sells and follows up without you lifting a finger."],
      ["\u{1F4E3}", "Ads & marketing", "Traffic that turns into customers \u2014 campaigns managed for you."],
      ["\u{1F3AC}", "Video & content", "Production that engages and positions your brand."],
      ["\u{1F4F1}", "Social media management", "A presence that grows on autopilot, in your voice."],
      ["\u{1F310}", "Website, app & software", "Built bespoke, from scratch \u2014 fast and beautiful."],
      ["\u{1F916}", "AI automation", "The repetitive work on autopilot."],
      ["\u2B50", "Reviews & reputation", "More 5-stars, more trust, more sales."]
    ],
    ideasTitle: "3 ideas to start now",
    ideas: [
      "Recover missed calls \u2192 every unanswered call becomes a booking.",
      "Turn followers into customers \u2192 content + ads that convert.",
      "Get operations off your back \u2192 AI handles the repetitive work 24/7."
    ],
    cta: "Get my proposal \u2192",
    cta2: "See everything we do \u2192",
    foot: "Reply to this email with your business \u2014 we'll build a proposal tailored to you."
  };
  const svc = /* @__PURE__ */ __name(([ic, title, desc]) => `<tr><td style="padding:7px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="46" valign="top">
        <div style="width:36px;height:36px;border-radius:10px;background:${B.panel2};border:1px solid ${B.line};box-shadow:inset 0 1px 0 ${B.edge};font-size:18px;text-align:center;line-height:36px;">${ic}</div>
      </td>
      <td valign="top" style="font-family:'Segoe UI',Arial,sans-serif;padding-left:6px;">
        <div style="font-size:14.5px;font-weight:700;color:${B.ink};letter-spacing:.1px;">${title}</div>
        <div style="font-size:12.5px;color:${B.muted};line-height:1.55;margin-top:2px;">${desc}</div>
      </td></tr></table></td></tr>`, "svc");
  const idea = /* @__PURE__ */ __name((x) => `<tr><td style="padding:5px 0;font-family:'Segoe UI',Arial,sans-serif;font-size:13.5px;color:${B.ink2};line-height:1.55;">
    <span style="color:${B.gold};font-weight:800;">\u2192</span> ${x}</td></tr>`, "idea");
  const body = `
  ${h1img("proposal", lang, t.h1, esc(business))}
  <div class="g-intro" style="font-size:15px;color:${B.ink2};line-height:1.72;margin-top:12px;">${t.intro}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};font-family:'Segoe UI',Arial,sans-serif;margin-bottom:8px;">${t.servicesTitle}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${t.services.map(svc).join("")}</table>`)}
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};font-family:'Segoe UI',Arial,sans-serif;margin-bottom:6px;">${t.ideasTitle}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${t.ideas.map(idea).join("")}</table>`)}
  <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.site + "/marketing")}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.site)}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body }) };
}
__name(proposalEmail, "proposalEmail");
function proofEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name);
  business = esc(business);
  const t = lang === "pt" ? {
    subject: `${name}, veja o que o Gui faz por neg\xF3cios como o seu`,
    pre: `Atende, agenda e fecha 24/7 \u2014 enquanto voc\xEA cuida do resto.`,
    eyebrow: "Prova \xB7 resultados reais",
    h1: `O que o Gui j\xE1 faz, ${name}`,
    intro: `Voc\xEA n\xE3o precisa imaginar \u2014 \xE9 isto que o Gui faz todo dia por neg\xF3cios como <span style="color:${B.ink};font-weight:600;">${business}</span>:`,
    points: [
      ["\u{1F4DE}", "Atende toda liga\xE7\xE3o", "Mesmo \xE0s 21h, fim de semana, feriado \u2014 nenhuma chamada vira caixa postal."],
      ["\u{1F4C5}", "Agenda sozinho", "Marca, confirma e lembra \u2014 a agenda enche sem voc\xEA."],
      ["\u{1F4AC}", "Faz follow-up", "Responde no WhatsApp em segundos e recupera o cliente que ia embora."],
      ["\u{1F4C8}", "Vira dado pro marketing", "Cada conversa alimenta os an\xFAncios \u2014 voc\xEA cresce com o que j\xE1 tem."]
    ],
    stat: "Em pilotos: 0 liga\xE7\xF5es perdidas \xB7 agenda mais cheia \xB7 clientes recuperados no autom\xE1tico.",
    cta: "Ver o Gui ao vivo \u2192",
    cta2: "Quero pro meu neg\xF3cio \u2192",
    foot: "Responda este email \u2014 em 10 minutos te mostro funcionando no seu caso."
  } : {
    subject: `${name}, see what Gui does for businesses like yours`,
    pre: `Answers, books and closes 24/7 \u2014 while you handle the rest.`,
    eyebrow: "Proof \xB7 real results",
    h1: `What Gui already does, ${name}`,
    intro: `You don't have to imagine it \u2014 here's what Gui does every day for businesses like <span style="color:${B.ink};font-weight:600;">${business}</span>:`,
    points: [
      ["\u{1F4DE}", "Answers every call", "Even at 9 PM, weekends, holidays \u2014 no call goes to voicemail."],
      ["\u{1F4C5}", "Books on its own", "Schedules, confirms and reminds \u2014 the calendar fills without you."],
      ["\u{1F4AC}", "Follows up", "Replies on WhatsApp in seconds and wins back the client who was leaving."],
      ["\u{1F4C8}", "Feeds your marketing", "Every conversation fuels the ads \u2014 you grow with what you already have."]
    ],
    stat: "In pilots: 0 missed calls \xB7 fuller calendar \xB7 customers won back on autopilot.",
    cta: "See Gui live \u2192",
    cta2: "I want this for my business \u2192",
    foot: "Reply to this email \u2014 in 10 minutes I'll show it working for your case."
  };
  const pt_ = /* @__PURE__ */ __name(([ic, ti, de]) => `<tr><td style="padding:7px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="44" valign="top"><div style="width:34px;height:34px;border-radius:10px;background:${B.panel2};border:1px solid ${B.line};box-shadow:inset 0 1px 0 ${B.edge};font-size:17px;text-align:center;line-height:34px;">${ic}</div></td>
    <td valign="top" style="font-family:'Segoe UI',Arial,sans-serif;padding-left:6px;"><div style="font-size:14px;font-weight:700;color:${B.ink};">${ti}</div><div style="font-size:12.5px;color:${B.muted};line-height:1.55;margin-top:2px;">${de}</div></td></tr></table></td></tr>`, "pt_");
  const body = `
  ${h1img("proof", lang, t.h1, esc(name) + " \u{1F331}")}
  <div class="g-intro" style="font-size:15px;color:${B.ink2};line-height:1.7;margin-top:12px;">${t.intro}</div>
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${t.points.map(pt_).join("")}</table>`)}
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div style="font-size:13px;color:${B.gold};text-align:center;font-family:'Segoe UI',Arial,sans-serif;font-weight:600;">${t.stat}</div>
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.site + "/#try")}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.site + "/marketing")}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body }) };
}
__name(proofEmail, "proofEmail");
function reengageEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name);
  business = esc(business);
  const t = lang === "pt" ? {
    subject: `${name}, seu AI Growth Score est\xE1 te esperando`,
    pre: `60 segundos pra ver quanto ${business} est\xE1 deixando na mesa.`,
    eyebrow: "\xDAltima chamada \xB7 gr\xE1tis",
    h1: `Ainda d\xE1 tempo, ${name}`,
    intro: `Em <span style="color:${B.ink};font-weight:600;">60 segundos</span> voc\xEA descobre exatamente quanto ${business} est\xE1 perdendo por m\xEAs com liga\xE7\xF5es e leads que escapam \u2014 e o plano pra resolver. De gra\xE7a, sem compromisso.`,
    cta: "Fazer meu Growth Score \u2192",
    cta2: "Falar com um humano \u2192",
    foot: "Se n\xE3o for a hora, sem problema \u2014 respondo qualquer d\xFAvida por aqui."
  } : {
    subject: `${name}, your AI Growth Score is waiting`,
    pre: `60 seconds to see what ${business} is leaving on the table.`,
    eyebrow: "Last call \xB7 free",
    h1: `There's still time, ${name}`,
    intro: `In <span style="color:${B.ink};font-weight:600;">60 seconds</span> you'll see exactly how much ${business} loses each month to missed calls and slipping leads \u2014 and the plan to fix it. Free, no strings.`,
    cta: "Get my Growth Score \u2192",
    cta2: "Talk to a human \u2192",
    foot: "If now's not the time, no worries \u2014 reply here with any question."
  };
  const body = `
  ${h1img("reengage", lang, t.h1, esc(name))}
  <div class="g-intro" style="font-size:15px;color:${B.ink2};line-height:1.72;margin-top:13px;">${t.intro}</div>
  <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.site + "/quiz")}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.site + "/#try")}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body }) };
}
__name(reengageEmail, "reengageEmail");

// api/nurture.js
var STEPS = { welcome: welcomeEmail, proof: proofEmail, proposal: proposalEmail, reengage: reengageEmail };
async function onRequestPost5(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json5({ ok: false, reason: "forbidden" }, 403);
    const b = await request.json();
    const to = (b.to || "").toString().trim();
    if (!to.includes("@")) return json5({ ok: false, reason: "need a valid email" }, 400);
    const step = STEPS[b.step] ? b.step : "welcome";
    const { subject, html } = STEPS[step]({
      name: (b.name || "there").toString().slice(0, 80),
      business: (b.business || "your business").toString().slice(0, 120),
      lang: b.lang === "pt" ? "pt" : "en"
    });
    const KEY = env.RESEND_API_KEY;
    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    if (!KEY) return json5({ ok: false, reason: "no key" });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html })
    });
    const data = await r.json().catch(() => ({}));
    return json5(r.ok ? { ok: true, step, id: data?.id || null } : { ok: false, error: data?.message || `HTTP ${r.status}` });
  } catch (e) {
    return json5({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
__name(onRequestPost5, "onRequestPost");
var json5 = /* @__PURE__ */ __name((o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }), "json");
async function onRequestOptions2() {
  return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
__name(onRequestOptions2, "onRequestOptions");

// api/welcome.js
async function onRequestPost6(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json6({ ok: false, reason: "forbidden" }, 403);
    const b = await request.json();
    const to = (b.to || "").toString().trim();
    if (!to || !to.includes("@")) return json6({ ok: false, reason: "need a valid email" }, 400);
    const { subject, html } = welcomeEmail({
      name: (b.name || "there").toString().slice(0, 80),
      business: (b.business || "your business").toString().slice(0, 120),
      lang: b.lang === "pt" ? "pt" : "en"
    });
    const KEY = env.RESEND_API_KEY;
    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    if (!KEY) return json6({ ok: false, reason: "no key" });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html })
    });
    const data = await r.json().catch(() => ({}));
    return json6(r.ok ? { ok: true, id: data?.id || null } : { ok: false, error: data?.message || `HTTP ${r.status}` });
  } catch (e) {
    return json6({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
__name(onRequestPost6, "onRequestPost");
var json6 = /* @__PURE__ */ __name((o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }), "json");
async function onRequestOptions3() {
  return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
__name(onRequestOptions3, "onRequestOptions");

// api/daily-digest.js
async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = new URL(request.url);
    let p = {};
    if (request.method === "POST") {
      p = await request.json().catch(() => ({}));
    }
    const q = /* @__PURE__ */ __name((k) => p[k] ?? url.searchParams.get(k), "q");
    if (env.DIGEST_TOKEN && q("token") !== env.DIGEST_TOKEN) return json7({ ok: false, error: "unauthorized" }, 401);
    const to = (q("to") || env.OWNER_EMAIL || "smart@guileoai.com").toString().trim();
    if (!isOwnerEmail(to, env)) return json7({ ok: false, error: "recipient not allowed" }, 403);
    const lang = q("lang") === "pt" ? "pt" : "en";
    const name = (q("name") || "there").toString().slice(0, 80);
    const SB_URL = env.GUI_ACTIONS_SUPABASE_URL || "https://fccwbafkbhkyrvauzshl.supabase.co";
    const SB_ANON = env.GUI_ACTIONS_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjY3diYWZrYmhreXJ2YXV6c2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTU3NzQsImV4cCI6MjA5NDI5MTc3NH0.knDpHzK_cfpqmUzpLI4rTndAumn1yepCiRwCSAqwSNs";
    const sinceISO = new Date(Date.now() - 24 * 3600 * 1e3).toISOString();
    let rows = [];
    try {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/admin_actions`, {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: env.ADMIN_TOKEN || "guileo2026" })
      });
      if (r.ok) {
        const all = await r.json();
        rows = (Array.isArray(all) ? all : []).filter((x) => x.action === "lead" && new Date(x.created_at) >= new Date(sinceISO)).slice(0, 40);
      }
    } catch {
    }
    const channelFor = /* @__PURE__ */ __name((src) => {
      const s = (src || "").toLowerCase();
      if (s.includes("config") || s.includes("quote")) return "\u{1F9EE} Quote tool";
      if (s.includes("call") || s.includes("phone") || s.includes("live")) return "\u{1F4DE} Call-back";
      if (s.includes("onboard") || s.includes("portal")) return "\u{1F680} Signup";
      if (s.includes("whats")) return "\u{1F4AC} WhatsApp";
      return "\u{1F310} Website";
    }, "channelFor");
    const heatFor = /* @__PURE__ */ __name((src) => {
      const s = (src || "").toLowerCase();
      if (s.includes("config") || s.includes("quote") || s.includes("onboard")) return "hot";
      if (s.includes("call") || s.includes("whats")) return "warm";
      return "new";
    }, "heatFor");
    const leads = rows.map((x) => ({
      name: x.name || "New contact",
      heat: heatFor(x.source),
      channel: channelFor(x.source),
      want: x.details || x.business || "Reached out \u2014 wants to talk.",
      action: lang === "pt" ? "O Gui capturou e qualificou \u2014 pronto pra voc\xEA fechar." : "Gui captured & qualified \u2014 ready for you to close."
    }));
    if (leads.length === 0) return json7({ ok: true, sent: false, reason: "no leads in the last 24h" });
    const dateLabel = (/* @__PURE__ */ new Date()).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", { weekday: "long", month: "short", day: "numeric" });
    const { subject, html } = dailyLeadsEmail({ name, dateLabel, leads, lang });
    const KEY = env.RESEND_API_KEY;
    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    if (!KEY) return json7({ ok: false, reason: "no key", leadCount: leads.length });
    const sr = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html })
    });
    const data = await sr.json().catch(() => ({}));
    return json7(sr.ok ? { ok: true, sent: true, leadCount: leads.length, id: data?.id || null } : { ok: false, error: data?.message || `HTTP ${sr.status}` });
  } catch (e) {
    return json7({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
__name(onRequest, "onRequest");
var cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
var json7 = /* @__PURE__ */ __name((o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...cors } }), "json");

// ../.wrangler/tmp/pages-FCJZ2u/functionsRoutes-0.9004732608289784.mjs
var routes = [
  {
    routePath: "/api/agent-action",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/call",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/email",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/email",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/lead",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/nurture",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions2]
  },
  {
    routePath: "/api/nurture",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/welcome",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions3]
  },
  {
    routePath: "/api/welcome",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/daily-digest",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// ../../../../opt/homebrew/lib/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../opt/homebrew/lib/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
