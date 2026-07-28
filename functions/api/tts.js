// Cloudflare Pages Function — POST /api/tts → the REAL Gui voice (ElevenLabs) as browser audio.
// The call-simulator + personalized demo on the landing call this so a visitor hears the ACTUAL
// neural voice instead of the robotic browser speechSynthesis. Two picks: Victoria (♀) / Bruno (♂).
//
// COST CONTROL (defense in depth, because text is caller-supplied):
//   1. CACHE each rendered clip by (voice + sha1(text)) in KV → the fixed sim lines bill once, ever.
//   2. Per-IP rate limit (tight) so one client can't spray unique texts.
//   3. GLOBAL daily budget counter (KV) — a hard ceiling on ElevenLabs generations/day regardless of
//      IP or text, so distributed varied-text abuse can't run up an unbounded bill. Cache HITS never
//      count against it. + a hard text-length cap.
//   4. sameOrigin gate. Inert-que-acende: no ELEVENLABS_API_KEY → 501, UI falls back to browser voice.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";

// ElevenLabs PREMADE multilingual voice_ids (public on every account). Victoria = Sarah (warm female);
// Bruno = Brian (deep male). Server-side only — the client sends the KEY, never a raw voice_id.
const VOICES = {
  victoria: "EXAVITQu4vr4xnSDxMaL",
  bruno: "nPczCjzI2devNBz1zQrb",
};

const AUDIO_HEADERS = { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" };
const DAILY_CAP = 800; // max fresh ElevenLabs generations/day across ALL visitors (cache hits excluded)

async function sha1Hex(str) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "tts", 8)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const text = (b.text || "").toString().slice(0, 420).trim();
    // own-property allowlist (NOT `in`, which matches Object.prototype keys); defaults to victoria.
    const vk = String(b.voice || "victoria").toLowerCase();
    const voiceKey = Object.prototype.hasOwnProperty.call(VOICES, vk) ? vk : "victoria";
    const voiceId = VOICES[voiceKey];
    if (!text) return json({ error: "no text" }, 400);
    if (!env.ELEVENLABS_API_KEY) return json({ error: "voice unavailable" }, 501);

    // cache hit → serve stored clip, never re-bill and never touch the daily budget.
    const cacheKey = `tts:${voiceKey}:${await sha1Hex(text)}`;
    if (env.RATE_LIMIT) {
      try {
        const cached = await env.RATE_LIMIT.get(cacheKey, { type: "arrayBuffer" });
        if (cached && cached.byteLength) return new Response(cached, { headers: { ...AUDIO_HEADERS, "x-tts-cache": "hit" } });
      } catch { /* cache miss / KV hiccup → generate below */ }
    }

    // GLOBAL daily ceiling — only fresh generations count. Fail-open if KV is down (feature keeps
    // working; the per-IP cap still bounds a single abuser), but present under normal operation.
    let dayKey = "";
    if (env.RATE_LIMIT) {
      try {
        dayKey = `tts:day:${new Date().toISOString().slice(0, 10)}`;
        const used = parseInt((await env.RATE_LIMIT.get(dayKey)) || "0", 10) || 0;
        if (used >= DAILY_CAP) return json({ error: "daily voice budget reached" }, 429);
      } catch { dayKey = ""; }
    }

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_flash_v2_5", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true } }),
    });
    if (!r.ok) return json({ error: "tts failed", status: r.status }, 502);
    const audio = await r.arrayBuffer();
    if (!audio.byteLength) return json({ error: "empty audio" }, 502); // silent clip → let UI fall back
    if (env.RATE_LIMIT) {
      try { await env.RATE_LIMIT.put(cacheKey, audio, { expirationTtl: 60 * 60 * 24 * 30 }); } catch { /* best-effort cache */ }
      if (dayKey) { try { const used = parseInt((await env.RATE_LIMIT.get(dayKey)) || "0", 10) || 0; await env.RATE_LIMIT.put(dayKey, String(used + 1), { expirationTtl: 60 * 60 * 26 }); } catch { /* best-effort counter */ } }
    }
    return new Response(audio, { headers: { ...AUDIO_HEADERS, "x-tts-cache": "miss" } });
  } catch (e) {
    return json({ error: String(e).slice(0, 120) }, 400);
  }
}
