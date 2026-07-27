# 🗂️ CRM (the data spine) — Guileo Company-OS

> The single unified contact spine of the company-OS: one canonical record per person/company holding their full 360 timeline (every call, order, booking, payment, quote, message, note), lifetime value, lifecycle stage, segments, tags, consent and deals. Every other Guileo department resolves identity through it before acting and ingests through one funnel into it, so no data is ever siloed and Gui always acts on one complete view of each customer.

## 🗄️ Data model (entities this dept owns)
- **crm_contacts** — `id, tenant_id, primary_phone (E.164, unique per tenant), email (citext, unique per tenant), full_name, company_id -> crm_companies, lifecycle_stage (lead/active/loyal/lapsed/churned/vip), lead_source,`  
  ↳ The spine. One live row per human. Deduped on phone+email+fuzzy name. merged_into makes losers tombstones that redirect, never orphan a timeline. Every event in the company resolves to one of these rows via rpc_crm_resolve_contact.
- **crm_companies** — `id, tenant_id, name, domain, phone (E.164), industry, size, billing_address, primary_contact_id -> crm_contacts, account_value_cents, lifecycle_stage`  
  ↳ B2B parent. account_value_cents and lifecycle roll up from all linked contacts via trigger, so a company's worth is the sum of its people's real money — same ledger source as contacts, no separate accounting.
- **crm_deals** — `id, tenant_id, contact_id -> crm_contacts, company_id -> crm_companies, pipeline_id, stage_id, title, value_cents, probability, expected_close_date, status (open/won/lost), lost_reason, source_action_`  
  ↳ Opportunities/quotes in flight. Opened from a gui_actions quote, advanced to Booked by biz_appointments confirm, Won by revenue-ledger payment — every stage move is backed by a real source row, never manual guesswork. Always tied to a contact (and company if any).
- **crm_pipelines / crm_stages** — `pipeline.id, tenant_id, name, vertical; stage.id, pipeline_id, name, order_index, default_probability, is_won, is_lost`  
  ↳ Per-tenant configurable stages (Inquiry -> Booked -> Paid -> Repeat). Vertical templates (restaurant/clinic/services) seeded by the same auto-provision flow that mints a tenant, so a paying client gets a working pipeline with zero manual setup.
- **crm_timeline_events** — `id, tenant_id, contact_id -> crm_contacts, event_type (call/sms/email/booking/payment/quote/note/automation/stage_change/consent_change/merge), source_table (gui_actions/client_events/biz_appointments`  
  ↳ The 360 read-model. Append-only projection of every department's rows onto one contact, in time order. dedupe_key makes ingestion idempotent so a retried webhook never double-posts an event — directly closes the idempotency gap flagged in the hardening audit.
- **crm_segments** — `id, tenant_id, name, type (dynamic/static), rule_jsonb (filter DSL over contacts/tags/LTV/lifecycle/last_seen), member_count, refreshed_at, used_by_dept (marketing/sales/automations)`  
  ↳ Saved live audiences (lapsed-90d, VIP, no-show-risk). The single audience definition consumed by the existing Automations cron and Marketing/Sales — one source of truth for who gets contacted.
- **crm_tags / crm_contact_tags** — `tag.id, tenant_id, label, color, source (manual/gui); contact_tags.id, tenant_id, contact_id -> crm_contacts, tag_id -> crm_tags, applied_by (gui/user_id), applied_at`  
  ↳ Free-form + Gui-applied labels (allergy, big-spender, complainer, no-show-prone) usable inside segment rule_jsonb. Gui-applied tags carry the source so a human can trust/override them.
- **crm_dedupe_log** — `id, tenant_id, surviving_contact_id -> crm_contacts, merged_contact_id -> crm_contacts, match_score, match_basis (phone/email/name), merged_at, merged_by (gui/user_id), undone_at`  
  ↳ Audit of every identity merge. Because losers become merged_into tombstones (not deletions), every merge is fully reversible — undone_at re-splits the rows and re-points timeline events, so 360 timelines stitch cleanly and a wrong merge is never destructive.

## 🟢 Core features (what the owner does)
- Open any contact in the Cockpit and see the full 360 timeline — every call (with transcript + sentiment from call_logs), booking, payment, quote, message and note in one scroll, no tab-hopping.
- Search and filter the whole book by anything (name, phone, tag, last-visit, LTV band, lifecycle stage, churn-risk) and act in bulk: tag, add to segment, set consent, or hand to a campaign.
- Build and run deals on a drag-and-drop pipeline board per vertical; see weighted forecast, days-in-stage, and what is stuck — every card linked back to its source call/booking/payment.
- Create dynamic segments with a no-code rule builder (e.g. 'spent >$500 AND not seen in 60d AND consent_sms') that auto-refresh and feed Marketing, Sales and the Automations cron.
- Edit the one source-of-truth contact card (correct a phone, flip consent/DNC, set preferred channel, owner, locale) and have it instantly authoritative everywhere — including the call funnel before its next dial.
- Review and approve Gui's auto-merges in a dedupe queue, and undo any merge non-destructively.
- See lifetime value, visit count, next-expected date and lifecycle stage per contact and company, rolled up automatically from the revenue ledger.
- Export or one-click push a segment to a Marketing campaign or Sales follow-up queue, with DNC/consent already enforced at the segment level.

## 🟣 Gui automations (how Gui runs it — superhuman)
- Resolves or creates a contact on EVERY inbound/outbound event in real time — a first-time caller is a full deduped record before the call ends, because lead.js and call.js call rpc_crm_resolve_contact at ring time, not after.
- Continuous superhuman dedupe: a cron pass fuzzy-matches phone/email/name variants across the entire tenant 24/7 and auto-merges high-confidence pairs (with crm_dedupe_log audit), so the 360 view is never fragmented and humans only review the ambiguous middle band.
- Recomputes lifetime value, visit cadence and next-expected date after every payment/booking via trigger, and flips a contact to 'lapsed' the moment it crosses that contact's OWN expected-return window — never a flat global rule, never waiting for a human to notice.
- Predicts churn-risk (0-100) per contact from their personal rhythm and drops at-risk people into a retention segment before they go quiet, which the Automations cron then works as outreach.
- Auto-tags from call/message content (allergy, VIP, price-sensitive, complaint) and from behavior (no-show-prone, big-spender) at full call volume from call_logs sentiment+transcript, never missing one and never tiring.
- Keeps every dynamic segment live — re-evaluates affected segment membership on each ingested event, so Marketing/Sales/Automations always target a current audience around the clock.
- Advances deals with zero manual hygiene: opens a deal when Gui quotes (gui_actions), moves it to Booked when biz_appointments confirms, to Won when the revenue ledger records payment — the pipeline mirrors operational reality automatically.
- Enriches sparse records (full name, company, locale, preferred channel) inferred from interaction history, and propagates any consent/DNC change instantly to call.js and messaging so no department can contact someone the spine says to leave alone.

## 🔗 CRM-spine links (how it stays unified — zero silos)
- READ / IDENTITY: every department calls rpc_crm_resolve_contact(tenant_id, phone/email) before acting, returning one shared contact row (create-if-missing, tombstone-aware) — never a private copy. lead.js and call.js are wired through this so the call funnel and CRM are the same person.
- WRITE-IN / SINGLE FUNNEL: gui_actions (calls/quotes/charges), client_events (behavioral signals), biz_appointments (bookings) and the revenue ledger each fire rpc_crm_ingest_event, which attaches/creates the contact and appends one idempotent crm_timeline_events row — the one ingestion path that unifies all data and survives webhook retries.
- ROLLUP: a trigger on revenue-ledger insert recomputes crm_contacts.lifetime_value_cents + lifecycle_stage and rolls up to crm_companies.account_value_cents, so LTV is always the sum of real money across every dept, never a stale cache.
- SEGMENTS OUT: crm_segments are the audience source for the existing Automations cron and the Marketing/Sales depts, so a single audience definition drives campaigns, follow-ups and Gui outreach.
- CONSENT GUARD: call.js (DNC+caps) and any messaging dept read crm_contacts consent/DNC flags before dialing/texting; lead.js honors noCall through the same flags — the spine is the one authority that prevents siloed, non-compliant contact.
- TRANSCRIPTS IN: the call_logs mirror (project ynihodbknhjirkdogxby) feeds per-call sentiment+transcript into crm_timeline_events, so the portal 360 card and the transcript view read the same data with no second copy.

## 📈 KPIs it moves
- Duplicate ratio per tenant (target near-zero) and Gui auto-merge precision
- Identity resolution coverage — % of all events successfully attached to a known contact
- Average lifetime value per contact and per company (trend up)
- Lapsed-to-reactivated conversion rate driven by churn-risk segments
- Deal win rate, weighted pipeline value, and sales velocity (median days in stage)
- 360 completeness — % of contacts with a unified multi-channel timeline
- Active-segment freshness (max staleness) and reach — % of contacts addressable by at least one live, consent-clean segment

## 🔨 Build in Guileo (reusing what exists)
- Tables in Supabase ynihodbknhjirkdogxby with tenant_id RLS (select/update scoped to tenant via portal auth, insert via service role only): crm_contacts, crm_companies, crm_deals, crm_pipelines, crm_stages, crm_timeline_events (append-only read-model), crm_segments, crm_tags, crm_contact_tags, crm_dedupe_log — unique indexes on (tenant_id, primary_phone) and (tenant_id, email), and on crm_timeline_events (source_table, source_id) for idempotency.
- RPCs (SQL pasted by Luis per the scheduling-engine workflow): rpc_crm_resolve_contact (phone/email -> contact, create-if-missing, tombstone-redirect), rpc_crm_ingest_event (single idempotent funnel from gui_actions/client_events/biz_appointments/revenue ledger -> contact + timeline row), rpc_crm_merge_contacts (+ crm_dedupe_log, reversible), rpc_crm_recompute_ltv, rpc_crm_eval_segment (run rule_jsonb -> members), rpc_crm_advance_deal.
- Triggers: revenue-ledger insert -> rpc_crm_recompute_ltv + lifecycle + company rollup; biz_appointments confirm -> advance linked crm_deal to Booked; gui_actions quote -> open crm_deal; any timeline insert -> re-eval affected crm_segments.
- Reuse existing pieces: extend call.js to read crm_contacts consent/DNC before each dial; route lead.js writes through rpc_crm_resolve_contact; point the call_logs mirror (transcript/sentiment) into crm_timeline_events; have the Automations cron pull crm_segments as its audience source instead of any private list.
- Endpoints under existing /api/* and /admin _admin_ok gating: /api/crm/contact (GET 360 card + timeline), /api/crm/search, /api/crm/segment (CRUD + live preview count), /api/crm/deal (board moves -> rpc_crm_advance_deal), /api/crm/merge (approve/undo). Add cron job crm-dedupe + crm-churn-scan via the automations cron.
- Cockpit portal views (per-tenant portal auth, /admin for cross-tenant): Contacts list + filter, Contact 360 timeline card, Deals pipeline board, no-code Segment builder, Dedupe review queue — built on the existing Cockpit shell and signal palette, screenshot-verified after deploy per the verify-visually rule.
