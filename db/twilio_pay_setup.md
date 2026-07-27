# Twilio Pay — pay by voice on the call (your setup steps)

This lets a caller pay by **reading their card on the phone**, captured securely by Twilio (PCI-compliant — the card never touches our servers). The code is already deployed at `/api/twilio-pay`; it just needs a **Pay Connector** configured in your Twilio account, plus one secret.

## What you do (one-time, ~15 min)

1. **Enable Pay** — Twilio Console → search "Pay" → enable **<Pay>** (Voice → Settings, or the Pay product page). You may need to accept PCI terms.

2. **Create a Pay Connector backed by Stripe**
   - Twilio Console → **Voice → Manage → Pay Connectors** (or search "Pay Connectors").
   - Add connector → choose **Stripe** → connect your Stripe account (the same one the site already uses).
   - Give it a **unique name** (e.g. `Guileo_Stripe`). Copy that name.

3. **Set the secret in Cloudflare Pages**
   - Cloudflare → Pages → `guileoai` → Settings → Environment variables (Production):
   - Add `TWILIO_PAY_CONNECTOR` = the connector name from step 2 (e.g. `Guileo_Stripe`).
   - (We already have `TWILIO_AUTH_TOKEN` and `SCHED_SECRET` set.)

4. **Tell me when done** — I flip the agent so Gui can offer "pay by card on the call" as an option, and we test it once.

## How it behaves
- Until `TWILIO_PAY_CONNECTOR` is set, `/api/twilio-pay` **gracefully falls back** to "I'll text you a secure link" (the link path already works) — so nothing breaks while you set this up.
- Once set: a call can run the secure `<Pay>` capture → on success it **logs the payment to the Cockpit revenue ledger** (category `voice_pay`) and thanks the caller; on a declined card it offers the text link instead.

## Important reality check (why the link is still the default)
Our calls run through the **ElevenLabs** AI voice. Twilio `<Pay>` is a separate Twilio call flow, so "card-by-voice mid-conversation" requires the AI to **hand the call to** `/api/twilio-pay` for the capture, then it ends. That handoff is the last wiring step (I'll do it after you finish the connector). For most local businesses the **SMS link is faster and converts better** (customer taps and pays on their own phone) — voice-card is best kept as a fallback for callers without a smartphone.

## Test (after setup)
Call the business number, ask to "pay by card on the phone", read a test card (Stripe test card `4242 4242 4242 4242` if the connector is in test mode) → confirm the Cockpit shows a `voice_pay` entry.
