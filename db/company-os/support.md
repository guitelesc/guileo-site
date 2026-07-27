# 🎧 Customer Support / Service — Guileo Company-OS

> The always-on resolution layer of the company-OS: one omnichannel inbox where Gui receives, triages, answers, and resolves every customer issue across voice/SMS/WhatsApp/email/web chat — opening and closing tickets, deflecting with a vector FAQ, measuring satisfaction, escalating only the hard ones to a human, and running post-service follow-up — every action threaded to the one CRM contact (contact_id) so support context is shared live with sales, scheduling, and billing, and every refund/re-book lands on the shared revenue ledger and biz_appointments rather than a support silo.

## 🗄️ Data model (entities this dept owns)
- **support_tickets** — `id, client_email (tenant), contact_id (CRM spine FK, NOT NULL — auto-resolved/created from channel identity before insert), channel (voice|sms|whatsapp|email|webchat), subject, body, status (open|pend`  
  ↳ Core unit of work. contact_id is mandatory and resolved via the CRM identity spine (phone/email/wa) so a ticket can NEVER exist off-contact; FKs to call_logs / biz_appointments / revenue ledger mean support reuses existing money+calendar+transcript stores instead of copying them.
- **ticket_messages** — `id, ticket_id (FK), contact_id (CRM FK, denormalized for timeline writes), direction (inbound|outbound), author_type (customer|gui|human), channel, body, attachments jsonb, intent, kb_article_ids int[`  
  ↳ Full per-ticket transcript including Gui drafts and human internal notes; mirrors the call_logs transcript pattern and carries contact_id + client_event_id so each message is a first-class entry on the contact 360 timeline, not buried in support.
- **kb_articles** — `id, client_email (tenant), title, body_md, tags text[], category, embedding vector(1536) (pgvector), status (draft|published|archived), helpful_count, not_helpful_count, deflection_count, auto_generat`  
  ↳ Per-tenant FAQ knowledge base, vector-embedded so Gui retrieves answers via kb_search; auto-grows from resolved tickets (source_ticket_id traces provenance) and feeds the same brain the voice/scheduling agents already use.
- **csat_surveys** — `id, ticket_id (FK), contact_id (CRM FK, NOT NULL), channel, score (1-5), nps (0-10, nullable), comment, sentiment, sent_at, responded_at, recovery_ticket_id (FK, nullable — the ticket auto-spawned on `  
  ↳ One survey per resolved ticket, always carrying contact_id so the score updates contact-level lifetime_csat; a low score auto-spawns recovery_ticket_id and escalates, closing the loop on the same contact.
- **escalation_rules** — `id, client_email (tenant), name, trigger (keyword|sentiment_neg|sla_breach|vip|repeat|refund_request|legal), match_config jsonb, route_to (human:<id>|team), notify_channel (sms|email|whatsapp|push), p`  
  ↳ Owner-defined plain-language when-to-hand-to-human policy; escalation_eval runs it on every inbound message and uses contact-level CRM flags (vip, lifetime_value, churn_risk) so 'VIP' and 'repeat' triggers read straight off the contact spine.
- **sla_policies** — `id, client_email (tenant), name, priority, first_response_mins, resolution_mins, business_hours jsonb, applies_to_category text[], active (bool)`  
  ↳ Per-tenant response/resolution targets that stamp sla_first_response_due_at / sla_resolution_due_at on ticket insert and feed the sla_sweep cron breach automations, reusing the same automations cron that drives scheduling reminders.

## 🟢 Core features (what the owner does)
- Unified omnichannel inbox in the Cockpit portal: every voice/SMS/WhatsApp/email/web-chat conversation as a threaded ticket in one view, each pinned to the customer's 360 CRM timeline so the owner sees support beside that contact's bookings and orders
- Watch Gui resolve live and step in: read Gui's drafted reply, approve/edit/send, or take over with one click (assigned_to flips to human:<id> and the contact timeline records the handoff)
- Author and curate the FAQ knowledge base (kb_articles) in the owner's own words, and approve/reject Gui's auto-drafted articles built from resolved tickets — one click publishes and embeds them
- Define escalation rules and SLA policies in plain language ('angry customer or refund over $200 -> ring my phone in 5 min'), with VIP/repeat triggers reading live off the CRM contact
- Satisfaction at a glance: CSAT/NPS trend, per-category sentiment, deflection rate, SLA-compliance %, and a live feed of at-risk (negative-sentiment) contacts pulled from the contact spine
- Trigger post-service follow-up sequences (review request, re-book nudge, win-back) from a ticket and see which tickets converted to revenue on the shared ledger — honoring each contact's do-not-contact flag
- Refund/credit and re-book from inside the ticket: issue a credit that posts to the shared revenue ledger or reschedule via biz_appointments under the same contact_id, no leaving the thread, no siloed copy of money or calendar
- Bulk actions and macros: merge duplicate tickets (re-parents messages, keeps contact_id), mass-close, and apply canned-but-personalized macros Gui rewrites per contact using their CRM history

## 🟣 Gui automations (how Gui runs it — superhuman)
- Answers every channel in under 5 seconds, 24/7, in the customer's language, with full memory of their CRM 360 (last biz_appointment, last ledger order/payment, every prior ticket) — never asks 'what's your account number?' because contact_id is resolved from the inbound phone/email/wa before the first word
- Auto-triages on arrival: classifies intent, sets category/priority, scores sentiment, stamps the SLA clock from sla_policies, and either resolves or routes — thousands of tickets in parallel with no queue, something no human support desk can match
- RAG-answers from kb_articles via pgvector kb_search; when no article exists but Gui reasons out the answer from CRM/policy context, it resolves the ticket AND auto-drafts a new KB article (source_ticket_id set) for one-click owner approval, so the company gets measurably smarter every single ticket
- Predicts and prevents tickets before they happen: detects failure clusters across the contact spine (a spike of no-shows, a delivery delay, a billing anomaly) and proactively messages exactly the affected contacts — pre-empting the complaint and the negative review
- Honors escalation_rules superhumanly: the instant a customer turns negative or hits a VIP/refund/legal trigger, Gui fires the human handoff with a full summarized brief (issue, contact history, what was tried, recommended remedy) so the human starts at 100% context in seconds, not minutes
- Never breaches SLA silently: sla_sweep runs every minute over sla_first_response_due_at / sla_resolution_due_at, auto-nudges or re-prioritizes, pings the owner before (not after) a breach, and logs the save to gui_actions
- Runs closed-loop CSAT: fires the survey at the right per-channel moment, and on a low score instantly opens a recovery ticket, apologizes in the customer's voice, offers a concrete remedy (credit to the ledger or a re-book), and alerts the owner — recovering detractors before they churn
- Drives post-service revenue: after a resolved/completed service it sequences review requests, re-book reminders, and win-back offers, attributes which follow-up converted on the shared ledger, and automatically backs off any contact carrying the do-not-contact flag — turning the cost center into a revenue engine

## 🔗 CRM-spine links (how it stays unified — zero silos)
- contact_id is NOT NULL on support_tickets, ticket_messages, and csat_surveys: the inbound webhook resolves the channel identity (phone/email/wa) to a CRM contact via the existing get_client_data / identity spine and creates the contact if new — so a support record can never exist off the contact, eliminating the silo by construction
- Every ticket lifecycle event appends to the contact's unified client_events timeline (event_type support.ticket_opened / replied / resolved / escalated / csat) with the ticket_message carrying its client_event_id, so sales and ops see the full support thread on the same record they already use
- Reads the contact 360 before answering — pulls last biz_appointments booking, revenue-ledger orders/payments, prior tickets, sentiment history, and consent/do-not-contact flags via support_contact_360 (a thin wrapper over the existing get_client_data spine) so every reply is context-aware
- Writes resolution and sentiment back onto the contact (last_support_sentiment, open_ticket_count, lifetime_csat, churn_risk) so scheduling, sales, and marketing can act on an at-risk customer from the one spine without querying support tables
- Every Gui support action (reply sent, refund issued, follow-up scheduled, handoff) is logged to gui_actions against the contact_id, reusing the exact same actions+events audit store as the voice and scheduling departments — one audit trail, not three
- Refunds/credits post to the shared revenue ledger and re-bookings to biz_appointments under the same contact_id (ledger_entry_id / appointment_id FKs on the ticket), so money and calendar stay single-source and the support dept reads/writes the company's real records, never a copy

## 📈 KPIs it moves
- First Response Time (target sub-minute via Gui) and Median Resolution Time
- Auto-resolution / deflection rate — % of tickets Gui closes with zero human touch
- CSAT score and NPS, plus % of low-scores recovered via the auto-spawned recovery ticket
- SLA compliance % (first-response and resolution within policy), and breaches pre-empted by sla_sweep
- Ticket reopen rate and repeat-contact rate (true quality of resolution)
- Post-service follow-up conversion: reviews collected, re-books generated, and win-back revenue attributed on the shared ledger
- Escalation rate and human handle-time — how little human labor the department consumes per resolved ticket

## 🔨 Build in Guileo (reusing what exists)
- Tables in Supabase ynihodbknhjirkdogxby via MCP apply_migration, RLS by client_email (read gated by connection key, anon insert-only for inbound webchat exactly like gui_actions): support_tickets, ticket_messages, kb_articles (enable pgvector, embedding vector(1536)), csat_surveys, escalation_rules, sla_policies — all carrying contact_id FK to the CRM contact spine
- RPCs as SECURITY DEFINER gated by INGEST_SECRET / SCHED_SECRET (same pattern as log_call): ticket_upsert (resolves/creates contact_id, stamps SLA from sla_policies, logs gui_actions + client_events), ticket_reply, ticket_assign, ticket_resolve, kb_search (pgvector match), kb_upsert, csat_record, escalation_eval(contact_id, message) -> route, sla_sweep, support_contact_360(contact_id) wrapping the existing get_client_data spine
- Pages Functions endpoints mirroring the call funnel's hardening: /api/support-inbox (validate client connection key, then list tickets), /api/support-reply, /api/support-webhook (ingest ElevenLabs voice + Twilio SMS/WhatsApp + parsed email, dedupe on provider message id like log_call's idempotency), /api/kb-search, /api/csat-callback
- Bridge reuse: extend functions/api/agent-schedule.js into /api/agent-support so Gui can call ticket_upsert / kb_search / escalation_eval during a live call, wiring ElevenLabs tools abrir_chamado and consultar_faq — and link the resulting ticket to its call_logs transcript via call_log_id
- Automations cron jobs on the existing cron (reuse the scheduling-reminder runner): sla_sweep (every minute -> nudge/escalate on sla_*_due_at), csat_dispatch (surveys on resolved tickets), follow_up_sequencer (post-service review/re-book/win-back, honoring do_not_contact from the contact), kb_autodraft (turn resolved tickets into draft kb_articles) — each writing gui_actions + client_events
- Portal views in Portal.jsx / the Cockpit: SupportInbox (threaded omnichannel list + transcript drawer reusing the CallLogs drawer component), TicketDetail (CRM 360 sidebar from support_contact_360 + Gui-draft approve/take-over), KnowledgeBase editor, SatisfactionDashboard (CSAT/NPS/deflection/SLA charts), and an Escalation+SLA settings pane
- Reuse, do not rebuild: gui_actions is the support audit trail, client_events is the contact-timeline write, the revenue ledger handles refunds/credits, and biz_appointments handles in-ticket rescheduling — support adds zero new audit, money, or calendar stores
