# PLUG: A2P 10DLC — US SMS Delivery (Twilio)

**Status: PARTIAL.** All sending/receiving code is built and Twilio credentials
(`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`) are already in
production. TCPA consent is already logged on every lead. What's missing is the
**carrier registration** (Brand + Campaign). Until that's approved, US carriers
silently drop every app-to-person SMS — reminders, review requests, win-backs and
missed-call text-back all no-op (the email reminder covers the gap meanwhile).

---

## What's already wired (no work needed)

| Piece | Where | State |
|---|---|---|
| SMS sender | `functions/lib/twilio.js` → `sendText()` | ✅ built, fail-open if unconfigured |
| Inbound text agent (AI reply + portal logging) | `functions/api/twilio-inbound.js` | ✅ built, signature-verified |
| Reminder / review / win-back automations | `functions/api/automations.js` | ✅ built, call `sendText` |
| STOP/opt-out handling | Twilio handles STOP/UNSTOP natively on the messaging number; inbound webhook also routes replies | ✅ |
| TCPA consent logging | `functions/api/lead.js:88-96` → calls Supabase RPC `log_consent` with phone, email, source, and consent text `"agreed to be contacted by Gui (call/text), STOP to opt out"` | ✅ proof-of-consent stored per lead |
| Twilio creds | Cloudflare Pages secrets `TWILIO_*` | ✅ present (per `db/GO_LIVE.md`) |

**So the only blocker is the A2P 10DLC registration in Twilio.** No new code.

---

## What Luis does (registration — ~30–45 min of clicking, then waiting)

Go to **Twilio Console → Messaging → Regulatory Compliance → A2P 10DLC**.

### Step 1 — Register the Brand (the legal company)
Have ready:
- **Legal business name** (exactly as on the EIN letter) — e.g. *Tribeca Global Inc.*
- **EIN** (US federal tax ID, 9 digits)
- **Business address** (the registered one on the EIN)
- **Website**: `https://guileoai.com`
- **Business type**: Private/LLC/Corp (match the EIN)
- **Industry**: Technology / Software (SaaS)
- **Authorized rep**: name, email (`luistelesc@gmail.com`), mobile
- Brand registration is a **one-time $4 fee** + ongoing vetting.

> Tip: choose **Standard** (vetted) brand if you'll send more than a tiny volume —
> it raises throughput and trust score. Standard vetting adds a one-time ~$40 fee
> but unlocks far higher daily message limits.

### Step 2 — Register the Campaign (the use case)
Pick use case: **Mixed / Low-Volume Mixed** (Guileo sends several message types:
appointment reminders, review requests, win-back, and conversational AI replies).

Paste these fields:

**Campaign description** (paste as-is):
> Guileo is a customer-engagement assistant for local businesses (restaurants,
> clinics, services). It sends appointment reminders, review requests, and
> win-back offers to customers of the business, and replies conversationally to
> customers who text the business number. Customers opt in by giving their phone
> number to the business (via web form, in person, or phone) and consenting to be
> contacted. Every message includes opt-out instructions; customers can reply STOP
> at any time to unsubscribe.

**Message flow / opt-in description** (paste as-is):
> End users provide their phone number and consent through the business's website
> booking/contact form (which displays the consent language below), in person at
> the business, or verbally on a phone call. Consent is recorded with timestamp,
> phone, source, and the consent text. No consent is purchased or shared with
> third parties.

**Opt-in language shown on the form** (this is the consent text the website must display next to the phone field):
> By providing your phone number you agree to receive appointment reminders,
> updates and offers by text and call from [Business Name] powered by Guileo.
> Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out, HELP
> for help.

**Sample messages** (paste these — Twilio requires 2+ realistic samples; each must show opt-out where applicable):

1. Reminder:
   > Hi {name}, this is Gui from {business}. Reminder: your appointment is tomorrow
   > at {time}. Reply C to confirm or R to reschedule. Reply STOP to opt out.

2. Review request:
   > Hi {name}, thanks for visiting {business} today! If you have a moment, we'd
   > love a quick review: {review_link}. Reply STOP to opt out.

3. Win-back:
   > Hi {name}, it's been a while — {business} would love to see you again. Reply
   > here to book and we'll find you a time. Reply STOP to opt out.

4. Conversational reply (inbound-triggered):
   > Hi! Thanks for reaching out to {business}. I can help you book, check hours,
   > or answer questions — what do you need? Reply STOP to opt out.

- **Opt-out**: confirm STOP/UNSTOP/HELP keywords are enabled (Twilio default on the
  Messaging Service — leave on). HELP reply should name the business and point to support.
- Attach the `TWILIO_FROM` number (or its Messaging Service) to this campaign.

### Step 3 — Submit and wait
- Twilio forwards Brand → TCR (The Campaign Registry) → carriers.
- Click submit on both Brand and Campaign.

---

## What the dev (Luis/me) wires

**Likely nothing in code** — the `TWILIO_*` env is already set and `sendText()`
already works. Two small things to verify once the campaign is approved:

1. **Confirm `TWILIO_FROM`** points at the number (or `messaging:` Service SID)
   attached to the approved campaign. If a Messaging Service is used instead of a
   raw number, `TWILIO_FROM` can stay a number as long as that number is in the
   service's sender pool.
2. **Confirm the inbound webhook** on the number is set to
   `https://guileoai.com/api/twilio-inbound` (Phone Numbers → number → Messaging →
   "A message comes in" → POST). This is what powers the AI text agent.
3. **Make sure the website form shows the opt-in language** above next to the phone
   field (so the registered opt-in flow matches reality — carriers spot-check this).

Env vars involved (all already present): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_FROM`, plus `ANTHROPIC_API_KEY` (for AI replies) and `INGEST_SECRET` (portal logging).

---

## Cost & timeline

| Item | Cost | Timeline |
|---|---|---|
| Brand registration | ~$4 one-time | minutes to submit |
| Standard brand vetting (recommended) | ~$40 one-time | 1–3 business days |
| Campaign registration | ~$15 one-time + ~$1.50–$10/mo per campaign | submit in minutes |
| Carrier approval (TCR → carriers) | included | **typically 1–5 business days**, occasionally longer |
| Per-message | ~$0.0079 + carrier fees per SMS segment | n/a |

**Bottom line for Luis:** ~$60 one-time + a few dollars/month, ~1 week of waiting.
No code ships. The moment the campaign is "approved", every SMS automation that's
been silently no-opping starts delivering — nothing to redeploy.
