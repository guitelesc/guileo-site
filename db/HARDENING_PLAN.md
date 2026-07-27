# Guileo — Zero-Failure Hardening Plan (8-agent audit, 2026-06-20)
51 confirmed critical/high defects. Apply top-down; deploy + /api/selftest green after each batch.

## TIER 0 — DATA LEAK / DOUBLE-CHARGE (launch blockers)
- [ ] 0.1/0.2 client_email from request body → cross-tenant read/write. FIX: tenant email from a STATIC per-agent header (`x-guileo-client`, set at provision), never from caller body; remove demo/OWNER fallbacks; reject if empty. (provision.js tools, agent-schedule.js, agent-action.js, pay-result.js, pay-phone.js)
- [ ] 0.3 orphaned calls → OWNER_EMAIL silently. FIX: attribution logging + orphaned_calls audit, no silent owner-bucket. (elevenlabs-webhook.js)
- [ ] 0.4 refund vs payment email path mismatch → wrong tenant debited. FIX: one canonical email extraction. (stripe-webhook.js)
- [ ] 0.5 concurrent Stripe webhooks double-provision. FIX: atomic mark_webhook_seen (unique constraint) + idempotent buyAndBindNumber + agent-create. (stripe-webhook.js, provision.js, SQL)
- [ ] 0.6 metadata credits bypass amount (100k cr for $0.01). FIX: credits from amount only. (stripe-webhook.js)
- [ ] 0.7 recurring booking race. FIX: request_id idempotency / atomic recurring RPC. (agent-schedule.js, SQL)

## TIER 1 — PAID-BUT-NOTHING (launch blockers; webhook must 500 so Stripe retries)
- [ ] 1.1 add_client_credits unchecked → 500 on fail. (stripe-webhook.js)
- [ ] 1.2 provisioning failure swallowed (returns 200) → 500. (stripe-webhook.js)
- [ ] 1.3 self-serve never seeds scheduling → call biz_admin_import. (stripe-webhook.js)
- [ ] 1.4 set_client_agent / set_client_number failure swallowed. (provision-client.js, provision.js)
- [ ] 1.5 number-bind failure still marks provisioned. (stripe-webhook.js)
- [ ] 1.6 revenue_record unchecked. (agent-action.js)
- [ ] 1.7 stored=false returned as ok:true. (agent-action.js)
- [ ] 1.8 promised confirmation never sent (no-email caller) → collect email first. (agent-action.js + prompt)

## TIER 2 — HIGH (before volume ramps)
Security: 2.1 hardcoded PEND_SECRET→env+rotate · 2.2 anon key→env+RLS audit · 2.3 DELETE /api/selftest before launch · 2.4 per-agent secret · 2.5 rate-limit webhooks.
Reliability: 2.6 elevenlabs dedup fail-closed · 2.7 idempotency keys revenue+number · 2.8 TCPA add_dnc checked · 2.9 unchecked ingest (twilio-inbound, proactive) · 2.10 partial-provision reconciler.
Agent: 2.11 language=auto · 2.12 tz per-location · 2.13 holds · 2.14 tool timeout 35s+recovery · 2.15 human-transfer/escalate action.
Payments: 2.16 max-amount caps · 2.17 guarded request.json() · 2.18 N+1 fan-out.

## TIER 3 — MEDIUM/LOW (post-launch): email lowercase, client_id UUID key, verify-after-write, INGEST_SECRET 501, CORS allowlist, prompt-injection filter, indexes, etc.

## INNOVATION
1. End-to-end idempotency keys (request_id through every mutating RPC + UNIQUE + ON CONFLICT DO NOTHING).
2. Health self-test cron + provisioning reconciler (catches "paid, got nothing" before the money-back hits).
3. Structured failure-event bus in /admin (emitFailure write-ahead → live ops feed + rate alerts).
