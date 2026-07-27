# Gui — Voice & Agent Setup (Four Seasons standard)

The OFFICIAL Gui voice = **masculine, Four Seasons concierge**, multilingual PT/EN/ES, on the **Flash v2.5** model (cheap + multilingual + low-latency; phone audio is 8kHz so HD voice is wasted).

Two places this applies:
1. **Your demo/production agent `GUIELO AGENT` (agent_5901ktdkev68f5kb161fmeax1rdm)** — configured by hand in the ElevenLabs dashboard. Apply the settings below.
2. **Client agents auto-created by the provisioner** (`provision-agent.js` / `provision-client.js`) — already use `eleven_flash_v2_5`, now carry the Four Seasons concierge prompt + a `voice_id` from env `ELEVEN_VOICE_ID`. Set that env var once you pick the voice and every new client agent is born with it.

## 1) Pick the voice (your ear decides — test in ALL 3 languages)
ElevenLabs → Voices → Voice Library → filter **Conversational**. Audition masculine, warm, refined:
- **Brian** — deep, warm, neutral → best across PT/EN/ES (top pick for the trilingual market)
- **George** — British, refined → most "Four Seasons", confirm the PT/ES accent suits you
Test each with: 🇧🇷 "Oi! Aqui é o Gui, posso te ajudar a agendar?" · 🇺🇸 "Hi! This is Gui — how can I help you book?" · 🇪🇸 "¡Hola! Soy Gui, ¿le ayudo a agendar?"

## 2) Voice settings (the "Four Seasons" delivery)
- Stability **~50–55%** (consistent but natural)
- Style **~0–15%** (calm, elegant — never theatrical)
- Speed **slightly slower** than default (unhurried, gracious — the butler pace)
- Model: **eleven_flash_v2_5**

## 3) Languages (multilingual)
Agent → Language settings → primary + **add PT, EN, ES** (all enabled). The agent auto-detects the caller's language and replies in it.

## 4) First message (trilingual — paste in "First message")
🇧🇷 "Guileo, com prazer. Aqui é o Gui — como posso cuidar de você hoje?"
🇺🇸 "Guileo, at your service. This is Gui — how may I take care of you today?"
🇪🇸 "Guileo, con mucho gusto. Soy Gui — ¿cómo puedo atenderle hoy?"

## 5) System prompt tone (add to the agent prompt)
"You are Gui, a Four Seasons-caliber concierge: gracious, calm, formal yet warm. You never say 'I can't' — you say 'leave it with me'. Always reply in the SAME language the caller speaks. Keep answers short, warm and unhurried, then confirm and close with elegance."

## 6) Economy levers (same screen)
- **LLM** (LLMs tab): switch to a small/fast model — **Gemini 2.0 Flash** or **GPT-4o-mini** or **Claude Haiku**. Plenty for a receptionist; ~5–10× cheaper than a big model (LLM is billed separately from the per-minute voice).
- **Max call duration** (Advanced): ~4–5 min + end-on-silence, so no forgotten call burns minutes.

## To propagate the chosen voice to ALL client agents
Once you have the voice id (Voice Library → the voice → copy its Voice ID), set in Cloudflare Pages env:
`ELEVEN_VOICE_ID=<the voice id>` → provisioned client agents will use it automatically (already wired).
