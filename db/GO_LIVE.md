# Guileo — GO-LIVE RUNBOOK (exact steps to make EVERYTHING fire)

The product/automation code is **built and complete**. What gates "tudo funcionando" is configuration + external approvals — NOT more code. This is the precise list, derived from every `env.*` the code reads. Prioritized: quick wins first.

## ✅ Already configured in production (Cloudflare Pages secrets)
ADMIN_TOKEN, AGENT_ACTION_SECRET, ANTHROPIC_API_KEY, DIGEST_TOKEN, ELEVENLABS_API_KEY, ELEVENLABS_PHONE_NUMBER_ID, ELEVEN_WEBHOOK_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, INGEST_SECRET, RESEND_API_KEY, SCHED_SECRET, STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, AGENT_TUNE_TOKEN.
→ Credentials for Twilio, ElevenLabs, Google, Stripe, Resend, Anthropic ALL present.

## ⚡ QUICK ACTIVATIONS (Luis, ~2 min each — biggest leverage)
1. **`PROACTIVE_EMAILS`** — NOT set → the proactive engine (appointment reminder EMAILS + 60-day win-back) only runs for demo test emails. SET it to the real business emails (comma-separated), e.g. `demo@guileoai.com,smart@guileoai.com`. Cloudflare → Pages → guileoai → Settings → Environment variables (Production) → add `PROACTIVE_EMAILS`. **This single var turns on the reminder/win-back automation for real clients.**
2. **`EMAIL_FROM` + verify the Resend domain** — not set → defaults to `noreply@guileoai.com`, which only delivers if `guileoai.com` is a **verified domain in Resend** (resend.com → Domains → add guileoai.com → add the DKIM/SPF DNS records in Cloudflare). Until verified, branded emails may not deliver. Set `EMAIL_FROM="Guileo <noreply@guileoai.com>"` once verified. (This was likely behind "não chegou email".)
3. **`OWNER_EMAIL`** — optional; defaults to smart@guileoai.com. Set if owner alerts should go elsewhere.
4. **`RATE_LIMIT` KV binding** — confirm a KV namespace is bound as `RATE_LIMIT` (Pages → Settings → Functions → KV bindings). Speed-to-lead abuse caps + missed-call cooldowns use it (fail-open if absent, so not fatal, but recommended).

## 🔌 EXTERNAL APPROVALS (Luis — these gate the SMS/voice/pay channels)
5. **A2P 10DLC registration (US SMS)** — Twilio creds exist, but US carriers won't DELIVER app-to-person SMS until your brand+campaign is registered/approved in Twilio (Messaging → Regulatory Compliance → A2P). Until then, every SMS automation (reminders/reviews/win-back/text-back) silently no-ops. ~days for approval; start it. (Email reminder already covers the gap meanwhile.)
6. **ElevenLabs credits** — `ELEVENLABS_API_KEY` set, but the account ran out ("This request exceeds your quota limit" dropped calls). Top up / upgrade at elevenlabs.com → Billing. Then outbound calls + the live demo work again.
7. **Twilio Pay connector + PCI** (`PAY_CONNECTOR`) — NOT set → phone payment (the `<Pay>` TwiML, like T-Mobile) is off. In Twilio Console: enable PCI Mode + add a Stripe Pay Connector (irreversible — use a subaccount), then set `PAY_CONNECTOR` to the connector name. Then Gui collects card by phone, PCI-safe.
8. **Google Calendar** — `GOOGLE_CLIENT_ID/SECRET` set. Confirm the OAuth client's redirect URI = `https://guileoai.com/api/gcal-connect` (Google Cloud Console → Credentials), and the Calendar API is enabled. Then a client connects in 1 click and Gui mirrors bookings to their Google Calendar.
9. (Optional) `LEAD_WEBHOOK` (Zapier/Sheet/CRM mirror), `SUPABASE_URL`+`SUPABASE_KEY` (dedicated leads table), `VAPI_*` (alt voice provider — not needed, using ElevenLabs).

## 🚀 PRODUCTION CUTOVER (deliberate, reviewed)
Tonight's big batch (the muuh-pay→owned DB code repoint, the visual/voice polish, the email-reminder automation) lives in the **working tree + preview branch**, NOT on `main`/production yet. To go live:
1. First: shrink the landing hero "24/7" stat (read as cheap — keep the orange + idea, smaller/elegant) and get Luis's visual OK on preview.
2. Confirm what `main` currently serves vs the working tree (the 28-file DB repoint must ship together so prod points at the owned DB `ynihodbknhjirkdogxby`).
3. `npm run build && npx wrangler pages deploy dist --project-name=guileoai --branch=main`.
4. Verify (see below).

## ✅ POST-GO-LIVE VERIFICATION
- Portal real-data: log in, connect key, see real calls/leads (already proven via /api/call-logs).
- Trigger `/api/proactive?token=DIGEST_TOKEN` (POST) → check `reminded`/`reactivated` counts > 0 for a business with upcoming email-contact appointments.
- Make a real ElevenLabs call → confirm it lands in the portal with transcript+sentiment (webhook) and doesn't drop (credits).
- Send a test lead with an email → prospect gets the instant branded email; owner gets the alert.
- Weekly report (Mon 13:00 cron) includes the call-sentiment block.

## Notes
- ElevenLabs agent id is hardcoded (`agent_5901ktdkev68f5kb161fmeax1rdm`); `ELEVENLABS_AGENT_ID`/`VAPI_*` env not required.
- Two booking systems exist: `biz_appointments` (the one Gui uses via /api/agent-schedule — email-capable, drives the new email reminders) and the older `client_bookings` (SMS cron). Long-term, consolidate onto biz_*.
- See [[project_guileo_roadmap]] for the buildable-vs-blocked split.
