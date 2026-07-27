# Guileo — Go-Live Checklist & Hardening

## 🚨 FIRST PAYING CLIENT — DO THESE BEFORE SHARING THE LINK (2026-06-23, 3-agent launch audit)
The CODE + DB are sound (verified against prod). The realistic "paid but gets nothing" risks are all CONFIG, in priority order — do these, then watch /admin during the first payment (the new red "⚠️ Falhas" panel surfaces any failure live):
1. **ElevenLabs has credits + `ELEVENLABS_API_KEY` set** — TOP risk. If out of quota/unset, the client pays and Gui never answers/calls. Top up + confirm.
2. **`RESEND_API_KEY` set AND `guileoai.com` verified in Resend (DKIM/SPF)** — else the welcome email with the connection code never arrives → client can't reach their real data. Send yourself a test.
3. **Each Stripe Payment Link charges EXACTLY $149 / $449 / $999 USD recurring** (`src/data/selfServePlans.js`). The webhook maps credits by exact cents (14900/44900/99900); a wrong price silently grants 1 credit/$. Open all three links and confirm.
4. **Secrets set in Cloudflare:** `AGENT_ACTION_SECRET` (without it Gui can talk but NOT book/order/quote/collect — tools aren't attached), `SCHED_SECRET`, `INGEST_SECRET`, `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN` (PAID account, not trial), `STRIPE_SECRET_KEY`+`STRIPE_WEBHOOK_SECRET`.
5. **Inbound model:** a customer calling the client's number → forwards to the client's phone; if missed/busy → text-back + **Gui auto-calls them back live** (the documented "busy→auto-callback" design). It does NOT answer live on the first inbound ring. Make sure that's the intended UX for this client (decide vs. binding the number to ElevenLabs for live-answer).
6. **Run the admin-password SQL** (strong secret handed over) + paste `db/support.sql` if not already.

CODE fixes shipped in this launch pass: pricing $49→**$149** everywhere client-facing (was a checkout trust gap); a prominent **"sample data — connect"** banner whenever a real client hasn't pasted their code (fabricated numbers no longer read as real money); **/admin red "⚠️ Falhas" panel** so the team sees paid-but-broken live; **agent-action CRM-timeline TDZ crash** fixed (was silently never logging); welcome email + GoLive now explain the connection-code/login-with-same-email step; Dialer no longer fakes "call done"; inbound voice message is bilingual + sets the callback expectation.

---

This is the punch-list to take guileoai.com from "live demo" to "takes paying clients safely."
Three audits ran (payment/provision, multi-tenant isolation, funnel robustness). Findings below.

---

## ✅ Fixed in this pass (already deployed)
- **`/api/gui-chat`** now has `sameOrigin` + rate limit (20/min/IP) — was an open Anthropic-cost drain.
- **`/api/support`** no longer lets a client token dump the whole cross-tenant ticket queue (`all:true` ignored; always scoped to the caller's email). Full queue stays admin-only via `/api/broto`. Added rate limit.
- **`/api/broto`** rate-limited (slows brute-force on the admin password).
- **`$-96` profit-impact bug** floored at 0 (refund/negative event no longer renders the headline red).
- **In-portal OnboardingWizard** now feeds the real funnel: every completion fires `/api/lead` (captured, noCall) and, when an email is given, `/api/selfserve-signup` (pre-seeds the Gui brain so payment auto-provisions).
- **`pay-result.js` + `pay-phone.js`** now verify the **Twilio HMAC signature** (`functions/lib/twilioSig.js`) before recording revenue / emitting `<Pay>` — forged-revenue injection closed.
- **`/api/call`** no longer accepts a client-supplied `agent_id` (was format-validated only → could dial through another tenant's agent); always uses the owner/env agent.
- **PER-TENANT KEY BINDING — the #1 blocker — done at the app layer using the PROVEN `get_client_data(email, key)` gate** (the same one call-logs/appointments/billing already use; it rejects an email↔key mismatch). Applied to every cockpit-reachable endpoint that read PII or fired money/calls: `crm.js` (contacts/invoices/deals/timeline), `support.js` (tickets), `reactivate.js` (REAL SMS/calls — cross-tenant outbound abuse closed), `noshow-radar.js` (appointment PII). All drop the `OWNER_EMAIL` fallback. **Verified in prod: forged email+token, blank email, and missing key all → 401; reactivate forged → 401.** No new SQL needed.
  - ⚠️ **Needs one logged-in smoke test:** I proved forged requests are rejected (401) but can't prove a *legit* client still loads (no real-tenant creds). Log into a real connected cockpit → confirm CRM 360 / Finance / Pipeline / no-show radar / reactivate still work. (Uses the identical `Array.isArray(d.events)` check call-logs uses in prod, so it should pass.)
- **`pay-result.js` + `pay-phone.js`** Twilio HMAC signature (forged-revenue closed). **`/api/call`** ignores client `agent_id` + per-destination cooldown (10min) so the direct path can't repeat-dial one number. **`/api/contract`** drops OWNER fallback + rate-limit (dual-path client/admin binding tracked below). Rate limits added to `support`/`broto`/`contract`. **`PEND_SECRET`** now read from `env` (rotation-ready, inline fallback). **`lead.js`**: a delivered owner email now counts as durable delivery (lead never silently lost when email is the only channel) + full HTML escaping of all lead fields in the owner email (injection closed).
- **Admin password**: strong 32-char secret generated; one-line `_admin_ok` reset SQL handed to Luis (rotates /admin + BROTO + all 33 admin RPCs at once).

---

## 🔑 LUIS-ONLY — set these to go truly live (Cloudflare Pages → Settings → Env vars)
Owning Supabase account = **smart@guileoai.com**. Set in Cloudflare Pages env (Production):

| Secret | Unlocks | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (whsec_…) | Real payments → auto-provision | Webhook endpoint = `https://guileoai.com/api/stripe-webhook` in the Stripe dashboard |
| Stripe **Payment Links** in `src/data/selfServePlans.js` (`url:`) | The Subscribe buttons on /planos | Already has placeholders; replace with your live Payment Links per plan |
| `ANTHROPIC_API_KEY` | Gui Support AI + landing gui-chat | |
| `ELEVENLABS_API_KEY` + `ELEVENLABS_PHONE_NUMBER_ID` | Real outbound PHONE calls + buy/bind a number per client | Connect a Twilio number in ElevenLabs → Conversational AI → Phone Numbers |
| `RESEND_API_KEY` + `EMAIL_FROM` | Real transactional emails (welcome code, lead alerts) | Templates already in `functions/lib/emailTemplates.js` |
| `SCHED_SECRET` | Scheduling/admin RPC gate | Must match the DB GUC (see secret rotation below) |
| `INGEST_SECRET` | DNC/dormant-import gate | If unset, DNC check is skipped (see CRITICAL #5) |
| `TWILIO_*`, `LEAD_WEBHOOK` (optional) | SMS, lead forwarding | |

**SQL to paste (Supabase → SQL Editor, logged in as smart@guileoai.com):**
- `db/pending_onboarding.sql` (auto-provision gate) — confirm applied.
- `db/support.sql` — applied ✓.
- Any others flagged below.

---

## 🔴 CRITICAL hardening — must address before real multi-client traffic (needs Luis + careful work)
These change auth/compliance/DB behavior, so they were NOT changed unilaterally — review & schedule:

1. **No per-tenant key (whole-platform cross-tenant exposure).** All cockpit/CRM/scheduling/call-log RPCs are gated by ONE global shared secret + a caller-supplied `p_email`. Anyone with the secret can read/write ANY tenant's data (CRM PII, call transcripts, invoices, even delete a business via `biz_admin_import replace:true`). **Fix:** issue a per-tenant key (random, stored hashed); each RPC resolves `client_email` FROM the key, ignoring caller-supplied email. The good pattern already exists in `db/2026-06-14_client_messages.sql` (`get_client_data(p_email, p_key)`) — adopt it everywhere.
2. **`crm.js` / `admin-blitz.js`** validate the token with `p_email:""` then scope by client-supplied `b.email` (never checked against the token) → cross-tenant read + dormant-row injection (drives real billed calls on another tenant). **Fix:** pass the real email to `blitz_stats` so a mismatch is rejected, or derive tenant server-side.
3. **`pay-result.js` / `pay-phone.js`** have NO Twilio signature check → forged revenue injection under any tenant + open TwiML. `twilio-pay.js` does it right (`validTwilioSig`). **Fix:** port the signature check, or delete these if superseded.
4. **Secrets committed in git/comments:** `gss_…` (`db/scheduling_engine.sql:9`), `gx_pend_…` (`db/pending_onboarding.sql` + `selfserve-signup.js`). **Rotate** and move to env/Supabase Vault.
5. **`call.js` DNC fails OPEN** when `INGEST_SECRET` unset (every opted-out number dialable). Per-phone cooldown + global daily cap live in `lead.js`, so the direct `/api/call` path is bounded only per-IP. Client-supplied `agent_id` lets a caller dial through another tenant's ElevenLabs agent. **Fix:** DNC fail-closed; move per-number caps into `call.js`; ignore client `agent_id` on the public path; add Cloudflare Turnstile.

## 🟠 HIGH (schedule soon)
- **Payment idempotency:** Twilio number purchase isn't idempotent → a Stripe webhook retry can double-buy a number. Credit grant is correctly idempotent (2-layer), but provision-dedup (`mark_webhook_seen`) lives only in the live DB, unversioned. **Fix:** idempotency key around number purchase; version the dedup RPC into `db/`.
- **Paid-but-nothing:** webhook claims/credits before some writes; a transient failure mid-flow can leave a payer with no working account. **Fix:** order writes so credit/provision is last + retried.
- **`lead.js` silent loss:** if all persistence paths fail it still returns `ok:true`; front-ends ignore `stored`. A lead can vanish with a success UI. **Fix:** return non-200 on total failure + always attempt the owner-email fallback; surface retry.
- **Double-submit race** double-dials a paid call (per-phone cooldown written only after dialing). **Fix:** write cooldown optimistically before the async dial.
- **Admin password** is the short `Guileo2026` across broto/contract/support/pay-link. Now rate-limited, but **move to a long random secret / real sessions.**

## 🟡 MEDIUM
- `support_ticket_reply/set` + `inventory_*` update by UUID with no tenant filter (admin-only today, but tighten).
- gui-chat trusts client-supplied assistant history (role-spoof/jailbreak — low impact, output only to the same user).
- Daily-cap read-modify-write in `lead.js` can overshoot 50/day under concurrency (soft ceiling).
- Contract capability tokens have no expiry and keep returning `body` after signing.

---

## ✅ Confirmed solid (audits' positive findings)
- Stripe webhook: signature-verified, credits-from-amount-paid (never metadata), 2-layer credit idempotency.
- `db/clients.sql` has real RLS (`uid = auth.uid()`); no `using(true)` policies anywhere.
- `twilio-pay.js` verifies the Twilio HMAC correctly.
- The Supabase key shipped in the bundle is the **anon** key (not a leak).

**Suggested order:** rotate secrets (#4) → per-tenant key (#1, the big one) → pay-result/pay-phone sig (#3) → crm/admin-blitz binding (#2) → DNC fail-closed + call caps (#5) → payment idempotency. Items #1–#5 are the launch blockers.
