// Curated menu of ElevenLabs PREMADE multilingual voices for the client's dedicated Gui.
// The seller picks ONE at onboarding (agent.voice_key) and the provisioner
// (functions/api/onboard-client.js) hands the voice_id to ElevenLabs when it births the agent.
//
// These are ElevenLabs PREMADE voices — public voice_ids available on EVERY account, so no
// per-client voice cloning or upload is needed (premade voices always exist). All are
// eleven MULTILINGUAL voices (langs:'all') — VERIFIED: they render through the multilingual TTS
// models (eleven_flash_v2_5 / turbo), so the SAME voice speaks the entire spoken-language list in
// LANGS_SPOKEN (functions/lib/provision.js): EN·ES·PT·HI·ZH(Mandarin)·YUE(Cantonese)·RU·KO·HT.
// langs:'all' means exactly that — no per-voice language restriction. DEFAULT_VOICE_KEY is a
// warm female (Sarah) — the natural fit for a spa/salon/clinic agent like "Lilian".
export const VOICES = [
  { key: "sarah",     label: "Sarah",     gender: "female", voice_id: "EXAVITQu4vr4xnSDxMaL", vibe: "Warm, professional — calm and reassuring", langs: "all" },
  { key: "matilda",   label: "Matilda",   gender: "female", voice_id: "XrExE9yKIg1WjnnlVkGX", vibe: "Warm, friendly — bright and welcoming", langs: "all" },
  { key: "charlotte", label: "Charlotte", gender: "female", voice_id: "XB0fDUnXU5powFXDhCwa", vibe: "Soft, elegant — a slight, charming accent", langs: "all" },
  { key: "alice",     label: "Alice",     gender: "female", voice_id: "Xb7hH8MSUJpSbSDYk0k2", vibe: "British, confident — crisp and composed", langs: "all" },
  { key: "brian",     label: "Brian",     gender: "male",   voice_id: "nPczCjzI2devNBz1zQrb", vibe: "Deep, professional — grounded and steady", langs: "all" },
  { key: "liam",      label: "Liam",      gender: "male",   voice_id: "TX3LPaxmHKxFdv7VOQHJ", vibe: "Warm, articulate — easy and clear", langs: "all" },
  { key: "bill",      label: "Bill",      gender: "male",   voice_id: "pqHfZKP75CvOlQylNhV4", vibe: "Older, trustworthy — seasoned and calm", langs: "all" },
  { key: "will",      label: "Will",      gender: "male",   voice_id: "bIHbv24MWmeRgasZH58o", vibe: "Friendly, approachable — natural and upbeat", langs: "all" },
];

// Warm female — good default for spa/salon/clinic (e.g. "Lilian").
export const DEFAULT_VOICE_KEY = "sarah";

// Resolve a stored voice_key back to its full voice object (falls back to the default).
export function voiceByKey(key) {
  return VOICES.find((v) => v.key === key) || VOICES.find((v) => v.key === DEFAULT_VOICE_KEY);
}
