// functions/lib/twilio.js — minimal Twilio sender for the automations engine.
// FAIL-OPEN by design: when Twilio creds aren't set yet, callers get {sent:false}
// instead of a throw, so the engine can count "skipped" and retry on a later run
// (we deliberately don't mark bookings as reminded until a real send happens).
//
// BI-MARKET routing: pass opts.market ("BR"|"US") or opts.channel ("whatsapp"|"sms").
// BRAZIL → WhatsApp (env.TWILIO_WHATSAPP_FROM, the dominant channel there);
// US/default → SMS (env.TWILIO_FROM, A2P). If the WhatsApp sender isn't configured yet
// it falls back to TWILIO_FROM so nothing breaks before the sender is approved.
export async function sendText(env, to, body, opts = {}) {
  const sid = env.TWILIO_ACCOUNT_SID, token = env.TWILIO_AUTH_TOKEN;
  const wantWa = opts.channel === "whatsapp" || opts.market === "BR";
  let from = (wantWa && env.TWILIO_WHATSAPP_FROM) ? env.TWILIO_WHATSAPP_FROM : env.TWILIO_FROM;
  if (!sid || !token || !from) return { sent: false, reason: "not configured" };
  try {
    // WhatsApp senders need the whatsapp: prefix on BOTH sides; mirror From onto To.
    if (wantWa && env.TWILIO_WHATSAPP_FROM && !from.startsWith("whatsapp:")) from = `whatsapp:${from}`;
    let dest = String(to || "").trim();
    if (from.startsWith("whatsapp:") && !dest.startsWith("whatsapp:")) dest = `whatsapp:${dest}`;
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: dest, From: from, Body: body }),
    });
    return { sent: r.ok, status: r.status };
  } catch (e) {
    return { sent: false, reason: String(e).slice(0, 120) };
  }
}
