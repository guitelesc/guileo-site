# 💰 Finance — Guileo Company-OS

> The autonomous money-engine of the company-OS: every booking, quote, or order becomes cash on time because Gui invoices, charges, chases, reconciles, and forecasts against the SAME CRM contact spine (client_events / gui_actions in ynihodbknhjirkdogxby) the rest of the OS uses — so no dollar, invoice, or payment ever lives in a silo apart from the contact who owes it.

## 🗄️ Data model (entities this dept owns)
- **fin_invoices** — `id, tenant_id, contact_id (FK CRM spine = client_credits/contact in ynihodbknhjirkdogxby), appointment_id (FK biz_appointments), quote_id (FK fin_quotes), number, currency, status[draft|sent|viewed|pa`  
  ↳ Every invoice is bound to a CRM contact AND to its originating biz_appointments/quote, never an orphan email. Money is integer cents (no float drift). Each row writes an invoice_sent/invoice_viewed client_events entry so it shows on the contact 360 next to calls and bookings.
- **fin_line_items** — `id, invoice_id (FK), tenant_id, description, qty, unit_cents, tax_rate, total_cents, product_ref (biz_services.id), staff_ref (biz_professionals.id)`  
  ↳ Itemized billing; staff_ref + product_ref let revenue-by-service/staff reports join straight to the scheduling engine. Reused verbatim for quote->invoice conversion.
- **fin_payments** — `id, tenant_id, contact_id (FK), invoice_id (FK), subscription_id (FK, nullable), amount_cents, method[card|cash|ach|link|terminal|pix], stripe_pi_id, mp_payment_id, status[pending|succeeded|failed|ref`  
  ↳ One row per money movement; refunds/disputes are status transitions, never deletes. Reconciled idempotently against processed_webhooks (reuses the mark_webhook_seen/claim_credit_event guard). Posts net_cents to the revenue ledger and a payment_received client_events entry on the contact.
- **fin_dunning_runs** — `id, tenant_id, invoice_id (FK), contact_id (FK), step[1..N], channel[voice|sms|whatsapp|email], scheduled_at, executed_at, outcome[promise|paid|no_answer|dispute|optout], promise_to_pay_at, gui_action`  
  ↳ Collections cadence state machine. Every touch logs a gui_actions row (so the contact 360 shows exactly how/when Gui chased) and any voice/SMS touch passes through call.js DNC+caps; voice dunning links to the call_logs transcript/sentiment row.
- **fin_subscriptions** — `id, tenant_id, contact_id (FK), plan, amount_cents, interval, status[active|past_due|paused|canceled], next_charge_at, stripe_sub_id, churned_at, churn_reason, client_event_id`  
  ↳ Recurring revenue + churn-dollar source of truth, tied to the contact. Status changes (past_due, churned) write a client_events entry AND stamp a status tag on the contact spine so Sales/Growth see it on the same record.
- **fin_cashflow_snapshots** — `id, tenant_id, as_of_date, cash_on_hand_cents, ar_outstanding_cents, ar_overdue_cents, projected_30d_in_cents, projected_30d_out_cents, runway_days, churn_dollars_cents, mrr_cents, forecast_inputs jso`  
  ↳ Daily materialized financial state powering the Cash Cockpit and Gui's forecasts. forecast_inputs records the booking-pipeline + per-contact pay-lag features used, so forecast accuracy is auditable per tenant.
- **fin_quotes** — `id, tenant_id, contact_id (FK), appointment_id (FK biz_appointments), status[draft|sent|viewed|accepted|declined|expired], total_cents, valid_until, accepted_at, converted_invoice_id (FK fin_invoices)`  
  ↳ Quotes live on the same contact spine as invoices so the quote->invoice->payment chain is one connected thread on the 360. Acceptance auto-converts line items into a fin_invoices row, closing the silo between estimating and billing.

## 🟢 Core features (what the owner does)
- One-tap invoice from any booking or quote: open a biz_appointments (or fin_quotes) record, hit Invoice, line items pre-fill from biz_services price/duration, and Gui sends it across the contact's preferred channel (the same channel the contact already uses in their 360).
- Live Cash Cockpit in the portal: cash on hand, AR aging buckets (0-30/30-60/60-90/90+), runway in days, MRR, and churn-$ this month, every tile drillable down to the exact contact on the CRM spine.
- Collections board: every overdue invoice rendered as a card carrying the contact's full 360 timeline (calls, bookings, last payment), last dunning touch, promise-to-pay date, and a 'let Gui chase' toggle that arms the dunning ladder.
- Accept payment any way: send a Stripe/PIX pay-link (reusing pay-link + stripe-webhook), charge a saved card, take a terminal/cash entry, or let the customer pay in the live call — all reconcile to one invoice and one contact.
- Refund / credit / write-off in one click, each posting a reversing entry to the revenue ledger and stamping a refund_issued/written_off client_events entry on the contact timeline.
- Per-service billing rules: deposit %, payment terms, late fees, tax rates, and dunning aggressiveness configured on biz_services.config — Gui then enforces them automatically at invoice time.
- Subscription & retainer management: recurring revenue, past-due subs, upcoming charges, and churn reasons in one view, each tied to its contact.
- Owner-grade reports on demand: P&L snapshot, sales tax owed, top debtors, and revenue by service/staff/channel (joining fin_line_items.product_ref/staff_ref to biz_*), exportable, no spreadsheet.

## 🟣 Gui automations (how Gui runs it — superhuman)
- Invoices the instant a service completes: a biz_appointments status flip to done fires the auto-invoice-on-complete cron job, which generates and sends the invoice in seconds, 24/7, across thousands of jobs with zero owner touch — idempotent on (appointment_id) so a job is never billed twice.
- Runs a never-sleeping, DNC-safe dunning ladder: friendly SMS at due+1, a real Gui voice call at due+5 (routed through call.js so caps + opt-out are honored and the call is transcribed into call_logs), WhatsApp at due+10, escalation at due+20 — and it adapts tone to the contact's past payment behavior read from their 360.
- Negotiates and books a promise-to-pay on a live call, writes promise_to_pay_at + a gui_actions row to the contact timeline, then auto-schedules the exact retry charge and confirms the moment it lands — collecting like a full AR team that never tires.
- Smart-retries failed/declined cards on the statistically optimal day/hour (post-payday, card-refresh windows) per that contact's history instead of blind retries, recovering involuntary churn — each retry guarded by an idempotency_key so a recovered charge can't double-bill.
- Predicts cash 30/60/90 days out by fusing the live biz_appointments booking pipeline, historical per-contact pay-lag, and fin_subscriptions renewals into nightly fin_cashflow_snapshots — and warns the owner BEFORE a cash crunch, not after.
- Flags churn-dollar risk early: a contact whose payment lag is rising or whose booking cadence drops gets surfaced as 'revenue-at-risk $X', stamps a revenue_at_risk tag on the contact spine for Sales/Growth, and proposes a save action Gui can execute on the spot.
- Auto-reconciles every Stripe/Mercado Pago webhook, terminal, and cash entry to the right invoice and contact through the processed_webhooks idempotency guard, closing the books continuously so the ledger is always correct with no double-posts.
- Right-sizes deposits and late fees per the contact's CRM-derived payment-reliability score and auto-applies them at invoice time, protecting working capital without the owner micromanaging.

## 🔗 CRM-spine links (how it stays unified — zero silos)
- Every fin_quotes, fin_invoices, fin_payments, and fin_subscriptions row carries contact_id and writes a client_events entry (quote_sent, invoice_sent, invoice_viewed, payment_received, refund_issued, churned) into ynihodbknhjirkdogxby so the contact's 360 timeline shows money alongside calls, bookings, and messages.
- Every Gui collections action (voice call, SMS, WhatsApp, promise-to-pay) is logged as a gui_actions record linked to the same contact — and voice touches link to their call_logs transcript+sentiment row — so a glance at the contact shows exactly how, when, and how warmly Gui chased.
- Finance reads CRM-derived signals (lifetime value, payment-reliability score, last-contact recency) to set deposit %, credit terms, and dunning tone per contact, and writes those computed fields back onto the contact record so Sales/Growth/Brain reuse them.
- Invoices and payments reconcile against biz_appointments via appointment_id (and quotes via quote_id), so a booking, its quote, its invoice, and its payment form one connected chain on the contact — never four silos.
- Churn-dollar and AR-risk flags are stamped as status tags on the same contact spine (past_due, revenue_at_risk, vip_payer) that Sales and Growth read, so the whole OS coordinates off one record instead of a separate finance database.

## 📈 KPIs it moves
- DSO (days sales outstanding) / average days-to-pay per tenant and per contact
- Collection rate % and total AR overdue ($ and aging mix 0-30/30-60/60-90/90+)
- Cash on hand and runway-days; 30/60/90-day cash-flow forecast accuracy (snapshot vs actual)
- MRR / recurring revenue and net revenue retention
- Churn dollars per month and involuntary-churn $ recovered via smart card retries
- Invoice-to-paid conversion %, quote-to-invoice conversion %, deposit capture rate, and failed-payment recovery rate

## 🔨 Build in Guileo (reusing what exists)
- Tables: fin_quotes, fin_invoices, fin_line_items, fin_payments, fin_dunning_runs, fin_subscriptions, fin_cashflow_snapshots in the OWNED Supabase project ynihodbknhjirkdogxby, each with tenant_id + RLS for per-tenant isolation (mirror the proven biz_* isolation) and contact_id FK to the migrated CRM spine — written as db/finance_engine.sql for Luis to paste per the DB-change workflow (Claude can't apply migrations on the live function source).
- RPCs (SECURITY DEFINER, gated by the existing _gui_sched_ok(secret)=SCHED_SECRET like biz_book/log_call): create_invoice_from_appointment(appointment_id, idempotency_key), record_payment(invoice_id, amount, method, idempotency_key), issue_refund(payment_id, amount, reason), advance_dunning(invoice_id) — each writes client_events + gui_actions and posts to the revenue ledger; all defensive (work before AND after the paste, falling back like bookIdem/claim_credit_event).
- Endpoints (Cloudflare Pages Functions, tenant pinned via the static x-guileo-client header set in provision.js, NEVER from the request body): functions/api/agent-invoice.js (Gui generates/sends invoices), functions/api/agent-collect.js (Gui drives dunning + promise-to-pay, voice via call.js), and extend the existing stripe-webhook + pay-link into idempotent fin_payments reconciliation reusing processed_webhooks/claim_credit_event — bridged on the proven agent-schedule pattern.
- Automations cron jobs registered in the existing automations cron: auto-invoice-on-complete (idempotent on appointment_id), dunning-ladder-tick (daily, honoring call.js DNC+caps), smart-retry-failed-cards, and a nightly fin_cashflow_snapshots rebuild + churn-$ recompute — each emitting failure-bus events (lib/failure.js emitFailure) on error so nothing fails silently per the hardening pass.
- Portal views following the locked design system + signal palette: Cash Cockpit dashboard (cash / AR-aging / runway / MRR / churn-$), Collections board (overdue cards with the contact 360 + 'let Gui chase'), Invoice/Quote detail editor, and an embedded Finance panel on the contact record showing invoices+payments+subscriptions inline — reusing Portal.jsx real-mode + the connection-key auth pattern from CallLogs.
- Reuse hard: send all invoice/receipt/quote/dunning emails strictly through functions/lib/emailTemplates.js (add finance templates, never ad-hoc HTML), apply the paid-but-nothing/idempotency guarantees (mark_webhook_seen atomic, idempotency_key UNIQUE) to every money path, add finance ops to /api/selftest, and screenshot-verify the Cockpit in prod after deploy before saying it's ready.
