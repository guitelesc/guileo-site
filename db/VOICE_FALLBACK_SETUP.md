# VOICE FALLBACK — 5-minute Twilio setup (Luis)

**What this is:** if ElevenLabs (the AI voice) is ever down, inbound calls on client numbers
would die in **silence**. Twilio has a built-in safety net: each phone number can have a
**Fallback URL** that fires automatically when the primary webhook errors or times out.
Ours is already deployed at `https://guileoai.com/api/voice-fallback` — the caller hears a
warm apology in the client's language, gets a WhatsApp text instantly, the client's portal
logs the missed call, and /admin gets a `voice_platform_down` alert (max 1 per 10 min).

**You only need to click this in the Twilio console — once per number.**

## Steps (repeat for EACH client number)

1. Log in at https://console.twilio.com
2. Left menu: **Phone Numbers → Manage → Active numbers**
3. Click the number
4. Scroll to **Voice Configuration**
5. Find the field **"Call fails"** (this is the *Primary handler fails* / Fallback URL —
   it sits right under the main "A call comes in" webhook)
6. Set it to:
   - URL: `https://guileoai.com/api/voice-fallback`
   - Method: **HTTP POST**
7. Click **Save configuration**

## ⚠️ Numbers imported into ElevenLabs

When a number is imported into ElevenLabs, ElevenLabs takes over the **primary** "A call
comes in" webhook — but the **fallback field stays on the Twilio side and stays empty
unless you set it**. So this step is EXTRA important for every ElevenLabs-connected number:
open each one in the **Twilio** console (not the ElevenLabs dashboard) and set the
"Call fails" URL exactly as above. ElevenLabs never touches this field, so it survives
agent re-syncs.

## Verify with one test number (recommended)

Before trusting it fleet-wide, prove it on ONE number:

1. Pick a test number and set its **primary** voice webhook to a broken URL
   (e.g. `https://guileoai.com/api/does-not-exist`) — keep the fallback set as above.
2. Call the number from your phone.
3. You should hear: *"Desculpa — estamos com uma instabilidade rapidinha…"* (language
   follows the client profile) and then receive a WhatsApp text within seconds.
4. Check /admin — a `voice_platform_down` failure event should be there.
5. **Restore the primary webhook** to its real value. Done.

## Notes

- No SQL to paste — this endpoint reuses the existing `lookup_client_by_number`,
  `get_client_profile` and `ingest_client_event` RPCs already live in the DB.
- The endpoint is Twilio-signature-verified: random visitors hitting the URL get a 403.
- Add this fallback step to the new-client onboarding checklist so every future number
  ships with the safety net from day one.
