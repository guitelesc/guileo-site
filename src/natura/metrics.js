// Pure metric computations shared across Master + per-channel dashboards. Every number here is
// derived directly from real rows (inbound_leads/outbound_leads/master_leads) — nothing invented.
// Schema has no bounce/unsubscribe/sequence-step tracking, so those metrics simply don't exist
// here; the house rule (see README-FOR-LEE.md #5) is to say "pending", never fabricate a number.

export function dayKey(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Builds a dense daily series (no gaps) between the earliest row and today, counting rows per day.
export function dailySeries(rows, dateField, days = 14) {
  const counts = new Map();
  for (const r of rows) {
    const k = dayKey(r[dateField]);
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    out.push({ label: d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }), value: counts.get(k) || 0 });
  }
  return out;
}

export function replyRate(sent, replies) {
  if (!sent) return 0;
  return Math.round((replies / sent) * 1000) / 10;
}

// Counts outbound rows that got an inbound reply back, keyed by channel — used for both the
// Master "Channel Mix" donut and each channel dashboard's own reply-rate tile.
export function channelMix(outboundRows) {
  const byChannel = new Map();
  for (const r of outboundRows) {
    if (r.direction !== "outbound") continue;
    byChannel.set(r.channel, (byChannel.get(r.channel) || 0) + 1);
  }
  return byChannel;
}

// Reads the per-channel sentiment column (voice_sentiment, sms_sentiment, email_sentiment,
// whatsapp_sentiment, instagram_sentiment, facebook_sentiment) — there is no flat "sentiment"
// column, each channel's workflow writes its own.
export function sentimentCounts(rows, channel) {
  const field = `${channel}_sentiment`;
  let positive = 0, negative = 0, neutral = 0;
  for (const r of rows) {
    if (r[field] === "positive") positive++;
    else if (r[field] === "negative") negative++;
    else if (r[field] === "neutral") neutral++;
  }
  return { positive, negative, neutral };
}

// channel is "messenger" in CHANNEL_LABEL/CHANNEL_COLOR (matches the DB's channel value for
// Facebook) but the new sentiment/status/note columns are prefixed "facebook_" per the user's
// own naming — map messenger -> facebook for those column lookups only.
export const SENTIMENT_COLUMN_CHANNEL = { messenger: "facebook" };

export const CHANNEL_COLOR = {
  email: "#3FB4FF", whatsapp: "#3E9468", voice: "#D6C29A", sms: "#FFC23D",
  messenger: "#4267B2", instagram: "#E0855F",
};
export const CHANNEL_LABEL = {
  email: "Email", whatsapp: "WhatsApp", voice: "Voice", sms: "SMS",
  messenger: "Facebook", instagram: "Instagram",
};
