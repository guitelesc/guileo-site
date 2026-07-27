# 📊 Accountants & Bookkeepers — Gui Agent Playbook

> Gui becomes the firm's tireless front desk, deadline-watcher, and collections engine — booking every client, chasing every missing document, predicting who'll ghost, and never letting an IRS or filing deadline pass unbilled or a dollar of AR slip during the busiest weeks of the year.

## 🟢 Core (table-stakes)
- **24/7 call & text answering** — Answers every call, SMS, and WhatsApp in EN/PT/ES, greets as the firm, explains services (tax prep, bookkeeping, payroll, sales tax, advisory), and captures caller name, entity type, and reason so no lead hits voicemail during tax season crunch.  
  ↳ *needs:* Twilio Voice + Programmable Messaging + WhatsApp Business API; ConversationRelay for live voice; lead.js capturing name/entity/intent into Supabase leads table
- **Consultation booking** — Books discovery calls, tax-prep intake, and year-end review meetings into the accountant's live calendar, respecting per-CPA availability, meeting type duration, and in-person vs Zoom/phone.  
  ↳ *needs:* Google Calendar API (/api/agent-schedule bridge) + biz_services/biz_staff/biz_hours tables; Zoom/Meet link generation on confirmation
- **Service & pricing quotes** — Quotes standard engagements by scenario — 1040 with Schedule C, S-corp 1120-S, monthly bookkeeping by transaction volume, payroll per employee — and explains what drives price (number of entities, states, K-1s).  
  ↳ *needs:* biz_services pricing table with tiered/variable rules; quote logic in agent prompt; SMS quote summary via emailTemplates/SMS
- **Client intake & document checklist** — Runs new-client intake (entity type, EIN/SSN on file?, prior-year return, states filed, software used), then texts a personalized document checklist (W-2s, 1099s, bank statements, P&L) with a secure upload link.  
  ↳ *needs:* Intake form schema in Supabase; secure upload portal link (e.g. signed Supabase Storage URL); SMS/WhatsApp checklist template
- **Deadline reminders** — Proactively reminds clients of their specific deadlines — quarterly estimated taxes (4/15, 6/15, 9/15, 1/15), 1099 filing (1/31), corporate (3/15), individual (4/15), extensions (10/15) — by SMS/voice with the exact action needed.  
  ↳ *needs:* Deadline rules engine keyed to entity_type + tax_year; scheduled-tasks cron; client roster with entity types in Supabase
- **Payment collection (invoices & retainers)** — Sends Stripe payment links by SMS for invoices and engagement retainers, takes card-by-voice for clients who call to pay, and confirms receipt — turning the awkward 'you owe us' call into a one-tap pay.  
  ↳ *needs:* Stripe payment links + Twilio Pay (PCI voice capture); invoice amount from QuickBooks/Xero; call.js gated outbound for reminders
- **Status & FAQ answers** — Answers 'is my return done?', 'when's my refund?', 'did you get my documents?', 'what do I still owe in docs?' instantly by reading the client's live engagement status instead of interrupting the preparer.  
  ↳ *needs:* Read access to engagement/workflow status (Karbon/Canopy/TaxDome API or Supabase mirror); client lookup by phone
- **Lead qualification & routing** — Qualifies inbound prospects (individual vs business, complexity, urgency, ideal-fit vs out-of-scope like crypto-heavy or multi-state) and routes hot/complex ones to a partner while booking simple ones directly.  
  ↳ *needs:* Qualification scoring in agent logic; gui_actions insert for routing; warm-transfer/notify partner via call + push
- **Missed-call & after-hours rescue** — Instantly texts back any missed or after-hours caller with a booking link and offer to answer questions, so a 9pm 'I got an IRS letter' panic converts instead of going to a competitor.  
  ↳ *needs:* Twilio missed-call webhook → SMS template; call funnel logic; after-hours flag in biz_hours
- **Reschedule & cancellation handling** — Lets clients reschedule or cancel intake/review meetings by text or voice and auto-offers the next open slot, freeing scarce CPA time during peak season.  
  ↳ *needs:* Google Calendar update via scheduling engine; reschedule honoring noCall flags; confirmation template

## 🔵 Advanced (proactive automations)
- **Missing-document chaser** — Tracks which source documents each client still owes against their checklist and auto-nudges only for the missing items ('we still need your 1099-INT and December bank statement') until the return can be worked — the #1 thing that stalls firms.  
  ↳ *needs:* Document checklist state per client in Supabase; upload-portal webhook to mark items received; scheduled nudge cron with escalation cadence
- **Quarterly estimated-tax outreach** — 30 days before each estimate deadline, proactively calls/texts every applicable client with their computed payment amount and a pay link, then confirms they paid — recovering revenue and saving clients from penalties.  
  ↳ *needs:* Estimated-payment amounts from tax software/prior-year safe harbor; client entity roster; call.js outbound batch + Stripe/IRS Direct Pay link
- **Engagement-letter & e-sign workflow** — Sends the annual engagement letter for e-signature, follows up until signed, and won't let work start unbilled or un-engaged — closing the liability and scope gaps firms hate chasing.  
  ↳ *needs:* DocuSign/Dropbox Sign API; engagement-letter template per service; signed-status webhook + reminder cron
- **Year-round advisory upsell** — Spots clients who only do annual taxes but show business complexity (Schedule C income, payroll, multi-state) and offers monthly bookkeeping, S-corp election analysis, or tax-planning sessions at the right moment.  
  ↳ *needs:* Client profile + prior-return signals; upsell rules; offer scripts; booking + Stripe for advisory packages
- **IRS/state notice triage** — When a client texts a photo of an IRS or state notice, classifies the notice type (CP2000, CP14, balance due, audit), explains urgency in plain language, and books a response call with the right deadline flagged.  
  ↳ *needs:* WhatsApp/MMS image intake; vision/OCR notice classifier; notice-type knowledge base; urgent booking path
- **Onboarding data collection** — For new business clients, collects EIN, entity formation details, prior accountant info, chart-of-accounts software, and bank-feed access requests in a guided conversation, prepping a clean engagement before day one.  
  ↳ *needs:* Structured onboarding flow; secure field capture; handoff packet generated for staff in Supabase/Airtable
- **Refund & balance-due status proactive ping** — After filing, proactively notifies clients when their return is accepted, when a refund is expected, or that a balance is due with a pay link — replacing the dozens of 'where's my refund?' calls.  
  ↳ *needs:* E-file acknowledgment status from tax software (Drake/Lacerte/ProConnect) or IRS WMR pattern; client comms preferences
- **Seasonal capacity & extension manager** — As 4/15 nears and capacity fills, automatically offers qualifying clients a filed extension (with estimated-payment guidance) and reschedules their prep to off-season, smoothing the firm's workload.  
  ↳ *needs:* Capacity/workflow load signal; extension eligibility rules; extension e-file trigger or staff task; client consent capture
- **Review-meeting prep & no-show defense** — Confirms tax-review meetings 48h and 2h out, ensures the client uploaded everything needed, and reschedules likely no-shows — protecting irreplaceable peak-season slots.  
  ↳ *needs:* Booking data + checklist completeness; reminder cron; no-show risk flag; auto-rebook offer
- **Reputation & referral capture** — After a return is filed and the client is happy, asks for a Google review and, for promoters, asks for a referral — turning tax season into a growth season the firm never has time to run manually.  
  ↳ *needs:* Filing-complete trigger; Google review link; sentiment gate from call_logs; referral capture into CRM

## 🟣 Superhuman (impossible for a human)
- **Mass deadline-day blitz** — On the morning of each filing/estimate deadline, simultaneously calls and texts all 500+ at-risk clients — those who haven't paid, haven't sent docs, or haven't filed — each with their exact personalized amount and action, in parallel in seconds. No human firm can reach hundreds of clients in one hour.  
  ↳ *needs:* call.js parallel dial with DNC+caps; per-client deadline/amount data; Stripe/IRS pay links; WhatsApp+SMS fan-out
- **Instant full-firm omniscience** — On any call, cross-references the client's entire history in milliseconds — every prior return, open balance, missing doc, last year's deductions, which states they file, their CPA's notes — and answers as if it had worked their file for a decade.  
  ↳ *needs:* Unified read across tax software + bookkeeping + CRM + call_logs; per-call context assembly; perfect-memory client record store
- **Never-sleeps deadline guardian** — Watches every client's every deadline across all entities and jurisdictions 24/7/365 and acts the instant a window opens or risk appears — including 1099s due 1/31, multi-state nexus, and S-corp election 2553 windows — so nothing ever slips through at 2am.  
  ↳ *needs:* Always-on deadline rules engine; multi-jurisdiction calendar; scheduled-tasks cron; entity roster with all states/entity types
- **Churn & non-return prediction** — Predicts which clients won't come back next season (late-payer, slow doc-sender, price-sensitive, went quiet) weeks before they ghost, and launches personalized win-back outreach automatically — saving recurring revenue before it's lost.  
  ↳ *needs:* Historical behavior features (payment lag, response time, sentiment); churn model; targeted outreach scripts via call/SMS
- **Real-time script A/B optimization** — Continuously runs A/B/n tests on its own intake pitch, quote framing, and document-chase wording across thousands of conversations, keeping whatever books and collects best — an optimization loop no human team could run.  
  ↳ *needs:* Experiment framework logging variant→outcome in gui_actions; conversion attribution; auto-promote winning variant
- **Mass-personalized off-season nurture** — Sends every single client individually relevant touches year-round — a Q3 tax-planning tip for the S-corp owner, a mileage-log reminder for the realtor, an estimated-payment heads-up for the freelancer — thousands of 1:1 messages no human could write.  
  ↳ *needs:* Per-client profile + entity/industry tags; content generation; channel preferences; scheduled personalized send
- **Demand & staffing forecast** — Predicts daily call/intake volume and document inflow across the season from historical patterns and current pipeline, telling the owner exactly when to add staff or open extension capacity before the wave hits.  
  ↳ *needs:* Time-series on call_logs + bookings + doc uploads; forecast model; owner dashboard/alert in portal
- **Perfect-memory multilingual concierge** — Remembers every client forever across years — their entity changes, their spouse's name, that they always file an extension, that they prefer Portuguese and WhatsApp — and resumes any conversation with zero re-explaining, in their language, indefinitely.  
  ↳ *needs:* Persistent per-client memory store; language preference from call_logs; cross-year linkage; EN/PT/ES voice
- **Instant penalty-exposure scanner** — Across the whole client base at once, instantly flags every client at risk of an underpayment, late-file, or 1099 penalty and triggers protective outreach the same minute — pre-empting IRS penalties no human could catch firm-wide in real time.  
  ↳ *needs:* Penalty rules + per-client filing/payment status; batch scan; auto-trigger outreach + staff alert
- **24/7 first-pass notice responder** — The moment a client forwards an IRS notice at any hour, instantly identifies it, drafts the appropriate response approach, gathers needed info from the client, and has a ready-to-review package waiting for the CPA at sunrise.  
  ↳ *needs:* OCR + notice classifier; response playbook KB; client info capture flow; staff-review packet generation
- **Firm-wide realization & write-off recovery scanner** — Continuously cross-checks every active engagement's logged hours and scope against what was actually billed, instantly surfacing under-billed work, unbilled out-of-scope requests, and write-down leakage across hundreds of clients at once — recovering revenue no human could audit return-by-return at scale.  
  ↳ *needs:* Time/WIP data from practice mgmt (Karbon/Canopy/TaxDome) + invoices from QuickBooks/Xero; per-engagement scope vs billed diff; staff alert + auto-draft supplemental invoice
- **Real-time multi-state nexus & filing-obligation watchdog** — Monitors every business client's revenue, payroll, and transaction footprint against all 50 states' economic-nexus and apportionment thresholds simultaneously, alerting the firm the instant a client crosses into a new filing obligation (sales tax, income tax, payroll registration) — surveillance no human team could run across an entire book in real time.  
  ↳ *needs:* Per-client revenue/transaction/payroll feed from QuickBooks/Xero/payroll API; live 50-state nexus-threshold rules engine; cross-entity rollup; staff alert + client outreach trigger
- **Instant whole-book law-change impact simulation** — When a tax law, rate, or threshold changes (new standard deduction, SALT cap, bonus depreciation, 1099-K threshold), instantly re-scores every client in the book to find exactly who is affected and by how much, then launches tailored outreach to each — an analysis that would take a human firm weeks, done in minutes.  
  ↳ *needs:* Structured client return-profile store; parameterized tax-rule engine; bulk re-scoring job; per-client impact estimate → personalized call/SMS via call.js fan-out
- **Always-on cash-flow & AR-aging collections brain** — Watches the firm's entire receivables ledger continuously and, the moment any invoice ages past terms, automatically escalates the right client through a tuned dunning sequence (gentle text → call → pay-link → partner alert) with per-client timing optimized from payment history — keeping firm-wide DSO low without a human ever touching the AR report.  
  ↳ *needs:* Live AR aging from QuickBooks/Xero; per-client payment-behavior model; tiered dunning state machine; Stripe links + Twilio Pay + call.js gated escalation
- **24/7 fraud & anomaly sentinel on client books** — For every bookkeeping client, continuously scans transaction feeds for duplicate payments, unusual vendors, payroll spikes, and out-of-pattern spend, flagging suspected error or fraud to both client and CPA within minutes of it posting — bank-reconciliation-grade vigilance across the whole book that no human could sustain daily.  
  ↳ *needs:* Real-time bank/transaction feed from QuickBooks/Xero/Plaid; per-client baseline anomaly model; severity scoring; instant alert to client + staff via SMS/portal
- **Predictive document-arrival orchestration** — Learns each client's historical document-delivery behavior and each issuer's release calendar (W-2s by 1/31, brokerage 1099s mid-Feb, K-1s late), then sequences and times every chase per client for maximum response — getting the whole book's documents in weeks earlier and smoothing the season, an orchestration no human could choreograph across hundreds of clients.  
  ↳ *needs:* Per-client doc-history + responsiveness features; issuer release-date calendar; optimal-timing model; checklist state + scheduled nudge engine

## 💰 Killer revenue moves
- Firm-wide realization recovery: continuously auditing logged hours and scope against what was actually billed surfaces under-billed and out-of-scope work across the entire book — recovering 5-15% of revenue that silently leaks as write-downs every season, with zero added staff.
- Quarterly estimated-tax + AR collections at scale: auto-call/text every applicable client their exact amount with a one-tap pay link on deadline day, plus an always-on dunning brain that drains aged receivables firm-wide — directly recovering tens of thousands in fees and AR that normally slip during the busiest weeks.
- Missing-document chaser that finishes returns earlier: stalled returns are unbilled returns; predictive, per-client document orchestration closes the doc gap weeks sooner, letting the firm bill materially more completed work in the same season without hiring.
- Year-round advisory & bookkeeping upsell triggered by nexus, complexity, and law-change events: convert once-a-year 1040 clients into monthly bookkeeping, S-corp, sales-tax, and tax-planning recurring revenue at the exact moment a real obligation or savings appears — the single highest-margin, highest-LTV lift a firm can make.
- Churn prediction + automated win-back: keeping existing recurring clients from ghosting protects the firm's most valuable asset — its book — at near-zero marginal cost, defending recurring revenue that costs 5-10x more to replace.
- After-hours & overflow lead capture during tax season: every panicked 'I got an IRS letter' or 'I need my taxes done' call answered and booked instead of lost to a competitor is a full new engagement — and an annuity, since tax clients renew for years.

## 🔌 Integrations to connect
- Twilio (Voice + ConversationRelay, Programmable Messaging, WhatsApp Business API, Twilio Pay for card-by-voice)
- Stripe (payment links, invoices, retainers, recurring advisory/bookkeeping subscriptions)
- QuickBooks Online & Xero (invoices, balances, client list, AR aging, transaction feeds, bookkeeping data) + Plaid for raw bank feeds
- Tax software / practice mgmt: Karbon, Canopy, TaxDome, or Drake/Lacerte/ProConnect/UltraTax (engagement status, time/WIP, e-file acks, client roster)
- Google Calendar / Microsoft 365 (per-CPA scheduling) + Zoom/Google Meet (consult links)
- DocuSign / Dropbox Sign (engagement letters, 8879 e-file authorizations, e-signatures)
- Secure document portal / Supabase Storage signed URLs (client uploads of W-2s, 1099s, statements) + OCR/vision for notice and document classification
- Google Business Profile (review requests) + CRM (HubSpot/pipeline) for lead and referral tracking
- Live 50-state nexus/threshold + tax-rule engine (Avalara/TaxJar data or maintained rules) for nexus watchdog and law-change simulation
- Supabase (ynihodbknhjirkdogxby): biz_* scheduling tables, leads, gui_actions, call_logs mirror, per-client memory + return-profile store

## 📝 Collect at signup (onboarding)
- Services & pricing model: list of engagements (1040, Sch C, 1120-S/1065, monthly bookkeeping tiers by transaction volume, payroll per-employee, sales tax, advisory) with prices, billing rates, and what drives variable pricing
- Client roster with key fields: name, phone, email, entity type, states filed, EIN/SSN-on-file flag, prior-year service, prior-year return profile, language preference (EN/PT/ES), and preferred channel
- Calendar & staff setup: each CPA/preparer's availability, meeting types and durations, in-person vs Zoom/phone, billing rate, and which partner gets routed complex/hot leads
- Deadline, billing & service rules: which deadline reminders apply (quarterly estimates, 1099s, 3/15, 4/15, 10/15 extensions), engagement-letter requirements, standard document checklist per service, AR terms, and the dunning/escalation cadence the firm wants
- Tool connections & credentials: QuickBooks/Xero (+ Plaid), tax/practice-management software (incl. time/WIP access), calendar, Stripe account, e-sign account, document portal, and Google Business Profile — plus business hours, after-hours policy, write-off/realization targets, and firm voice/tone (Four Seasons concierge persona)
