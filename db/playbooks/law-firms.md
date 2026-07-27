# ⚖️ Law Firms — Gui Agent Playbook

> Gui becomes the firm's tireless rainmaker and risk shield in one: a 24/7 intake paralegal that captures every after-hours injury call, runs conflicts and 50-state SOL in milliseconds, signs the retainer and collects the fee at 2am — then never lets a lead, deadline, or trust-account shortfall slip while turning the firm's entire dormant lead list into found money.

## 🟢 Core (table-stakes)
- **24/7 New-Matter Intake** — Answers every call/text/WhatsApp in EN/PT/ES, identifies practice area (PI, family, immigration, criminal, estate, employment), captures incident facts, opposing party, dates, and injuries into a structured intake record.  
  ↳ *needs:* Twilio Voice + Conversation Relay, WhatsApp Business API, intake schema in Supabase (matters table: practice_area, incident_date, parties, jurisdiction, summary), STT/TTS pipeline
- **Instant Conflicts-of-Interest Check** — Before booking, cross-references caller name + opposing party against the firm's existing client/adverse-party list and flags a conflict so the firm never takes a tainted matter or violates ethics rules.  
  ↳ *needs:* Read access to Clio/PracticePanther 'matters' + 'contacts' API, or uploaded conflicts CSV; fuzzy-match function (name/DOB/entity); flag stored on lead record
- **Statute-of-Limitations Triage** — Asks incident date, computes remaining SOL window for the matter's jurisdiction/practice area, and escalates time-sensitive matters (e.g. SOL expiring soon) to a human immediately.  
  ↳ *needs:* SOL rules table per state x practice_area, date-math function, escalation route (warm transfer / SMS to attorney on-call)
- **Consultation Booking + Retainer Calendaring** — Books paid or free consults into the right attorney's calendar by practice area and availability, sends confirmation + intake forms, and adds Zoom/in-office details.  
  ↳ *needs:* Google Calendar / Outlook / Calendly API, attorney-to-practice-area mapping, /api/agent-schedule bridge, email+SMS confirmation templates
- **Consult Fee + Retainer Collection** — Charges the consultation fee or initial retainer deposit via Stripe link by SMS or card-by-voice, and won't confirm the appointment until paid.  
  ↳ *needs:* Stripe Payment Links + Terminal/voice card capture, IOLTA vs operating account routing flag, payment-webhook to confirm booking
- **Fee-Structure & Process Q&A** — Explains contingency vs hourly vs flat fee, what documents to bring, what to expect at consult, and answers FAQ without giving legal advice — with a hard disclaimer guardrail.  
  ↳ *needs:* Firm knowledge base (fees, FAQ, disclaimers), retrieval over KB, 'no legal advice' guardrail prompt, unauthorized-practice-of-law (UPL) blocklist
- **Warm Transfer / Attorney On-Call Routing** — For high-value or urgent matters (arrest in progress, SOL imminent), live-transfers to the on-call attorney or paralegal, or pages them, with a spoken case summary.  
  ↳ *needs:* Twilio warm transfer + whisper, on-call schedule, escalation rules by matter value/urgency, SMS summary push
- **Document & Form Collection** — Texts secure upload links for police reports, medical records, immigration docs, or contracts and confirms receipt, attaching them to the matter.  
  ↳ *needs:* Secure upload portal (signed URLs), DMS integration (Clio Documents/NetDocuments), matter-linking, virus scan
- **Multilingual Intake (EN/PT/ES)** — Conducts the entire intake, booking, and payment flow natively in the caller's language — critical for immigration and PI clients — and tags the matter's language for attorney follow-up.  
  ↳ *needs:* Per-language voices/prompts, language-detect, translated intake forms + e-sign docs, language flag on matter
- **After-Hours Lead Capture + Next-Day Handoff** — Captures every after-hours/weekend lead with full facts and a callback commitment, then delivers a prioritized morning brief to the intake team.  
  ↳ *needs:* Lead queue in Supabase, priority scoring, morning digest email/Slack, callback SLA timers

## 🔵 Advanced (proactive automations)
- **Lead Scoring & Case-Value Estimation** — Scores each matter on likely value and merit (injury severity, liability clarity, insurance limits, damages) so attorneys spend time on the cases worth signing.  
  ↳ *needs:* Scoring model on intake fields, historical settlement data, insurance-limit lookup, score written to matter record
- **E-Signature Retainer Dispatch** — After a qualified consult, auto-generates the engagement letter / contingency agreement from a template, fills client + matter fields, and sends for e-signature — turning a lead into a signed client in minutes.  
  ↳ *needs:* DocuSign/Dropbox Sign API, retainer templates per practice area, merge-field mapping, signed-doc webhook back to DMS
- **Medical-Provider & Lien Coordination (PI)** — For injury clients, texts referrals to partner medical providers, books the appointment, and tracks treatment/lien status feeding into demand prep.  
  ↳ *needs:* Provider directory + booking API, lien tracker table, treatment-status reminders
- **Proactive Case-Status Updates** — Texts existing clients milestone updates (demand sent, court date set, settlement offer) without staff lifting a finger, cutting 'where's my case?' calls.  
  ↳ *needs:* Case-management webhook (Clio matter stage changes), client-comms templates, opt-in consent log
- **Court Date & Deadline Reminders** — Reminds clients of hearings, depositions, and document deadlines via SMS/WhatsApp with location, time, and what to bring, reducing failures-to-appear.  
  ↳ *needs:* Calendar/court-date feed, jurisdiction location data, reminder cadence engine
- **Stale-Lead Reactivation** — Re-engages leads who consulted but never signed, and old declined/dormant matters, with personalized check-ins timed to SOL windows.  
  ↳ *needs:* Lead lifecycle table, SOL-aware trigger, outbound dialer via call.js gate, personalized scripts
- **Referral & Co-Counsel Routing** — When a matter is outside the firm's practice area or jurisdiction, captures it and routes to a partner firm or referral network, preserving the referral fee.  
  ↳ *needs:* Referral partner directory + fee-split terms, routing rules, referral-tracking record
- **Review & Reputation Engine** — After a won case or closed matter, asks satisfied clients for a Google/Avvo review at the optimal moment, routing unhappy clients to private feedback first.  
  ↳ *needs:* Matter-outcome trigger, Google Business Profile + Avvo review links, sentiment gate, NPS capture
- **Intake-to-CRM Sync & Tagging** — Writes every interaction, transcript, and document into the practice-management system as a structured matter with tags, so attorneys open one record and see everything.  
  ↳ *needs:* Clio/PracticePanther/MyCase write API, transcript storage, tagging taxonomy
- **Unpaid-Invoice & Trust-Replenishment Follow-up** — Chases overdue hourly invoices and requests trust-account replenishment with a Stripe link, escalating tactfully before write-off.  
  ↳ *needs:* Billing system (Clio Manage) AR feed, Stripe links, IOLTA-aware messaging, dunning cadence

## 🟣 Superhuman (impossible for a human)
- **Mass Simultaneous Lead Capture** — Answers an unlimited number of inbound calls at the same instant after a TV/radio/billboard ad or a mass-tort event drops — no busy signal, no voicemail, every lead intake-completed in parallel.  
  ↳ *needs:* Horizontally-scaled Twilio concurrency, stateless intake workers, queue autoscaling, per-call matter isolation
- **Millisecond Conflicts + Jurisdiction Omniscience** — Cross-references the entire firm's matter history, all 50-state SOL and venue rules, and adverse-party databases in milliseconds on every call — something no paralegal could recall or look up live.  
  ↳ *needs:* In-memory conflicts index, SOL/venue rules engine, vector search over matter corpus, adverse-party data
- **500-Lead Reactivation Blast in One Hour** — Simultaneously calls and texts hundreds of dormant leads whose SOL is approaching, each with a personalized script referencing their specific incident and remaining time-to-file.  
  ↳ *needs:* Bulk outbound via call.js DNC/cap gate, per-lead personalization merge, SOL date-math at scale, TCPA consent ledger
- **Predictive No-Show & Sign-Rate Forecasting** — Predicts which consults will no-show and which leads won't sign, then auto-intervenes (extra reminders, fee waivers, earlier slots) before it happens.  
  ↳ *needs:* ML model on historical no-show/sign data, intervention playbooks, calendar + reminder hooks
- **Real-Time Script A/B Optimization** — Continuously A/B tests intake openings, fee explanations, and retainer-close phrasing across thousands of calls, auto-promoting the variant with the highest sign rate per practice area.  
  ↳ *needs:* Experiment framework, per-variant outcome tracking, multi-armed bandit, sign-rate attribution
- **Perfect Lifetime Client Memory** — Remembers every prior call, matter, family member, and preference forever, so a returning client (or their referral) is greeted with full context across years and practice areas.  
  ↳ *needs:* Unified client graph keyed by phone/identity, cross-matter history store, retrieval at call start
- **Mass-Tort / Class Eligibility Screening** — Screens thousands of callers against complex multi-factor eligibility criteria (drug, device, exposure, dates) for mass-tort campaigns instantly and routes only qualified plaintiffs to attorneys.  
  ↳ *needs:* Eligibility decision-tree per campaign, bulk screening pipeline, qualified-lead export to co-counsel/MDL lead firm
- **Always-On Demand Sensing & Capacity Forecasting** — Monitors call volume by practice area in real time, predicts surges (DUI weekends, post-storm property claims, layoff-driven employment cases) and pre-alerts the firm to staff up or pause ad spend.  
  ↳ *needs:* Time-series forecasting on intake volume, external signal feeds (weather/news), staffing/ad-spend alert hooks
- **Instant Multilingual Negotiation at Scale** — Handles hundreds of concurrent intakes flawlessly across EN/PT/ES with zero fatigue, accent-robust, never mishearing a date or name that a tired night-shift human would.  
  ↳ *needs:* Robust multilingual STT, confirmation read-backs, per-language QA scoring
- **Continuous Compliance & UPL Self-Audit** — Self-audits every conversation in real time against UPL, TCPA, and bar-advertising rules, blocking any response that crosses into legal advice or solicitation violations — across all calls at once.  
  ↳ *needs:* Live guardrail classifier, UPL/TCPA/ad-rule ruleset, transcript flagging + supervisor alert, immutable audit log
- **Zero-Leak Deadline Sentinel Across Every Matter** — Simultaneously watches the SOL, court-filing, and discovery deadline on every open and prospective matter in the firm 24/7/365, auto-escalating any clock approaching expiry — eliminating the missed-deadline malpractice claim that no human calendar-checker can guarantee across a full caseload.  
  ↳ *needs:* Per-matter deadline graph synced from Clio/court dockets, jurisdiction rules engine, tiered escalation (SMS→call→managing-partner page), immutable 'we warned you' audit trail for malpractice-insurer defense
- **Sub-30-Second Sign-Before-The-Competitor Race Engine** — On every PI lead, races the clock against rival firms by completing intake, conflicts, value-scoring, and firing the e-sign retainer within seconds of the call — winning the signature in the window where a human would still be writing down the caller's name.  
  ↳ *needs:* Pre-warmed retainer template + merge pipeline, parallelized conflicts/scoring, DocuSign instant-dispatch, sign-latency telemetry per lead vs market benchmark
- **Omniscient Insurance & Asset-Exposure Lookup at Intake** — During the live call, instantly estimates the defendant's insurance policy limits, corporate solvency, and prior-claims exposure to tell the firm in real time whether a case is collectible before they invest a dollar — knowledge no intake clerk could assemble live.  
  ↳ *needs:* Policy-limit/coverage data sources, business solvency + litigation-history APIs, asset/lien databases, collectability score written to matter at intake
- **Firm-Wide Settlement-Outcome Prediction From Day One** — At intake, predicts likely settlement range, time-to-resolution, and win probability by matching the new matter against the firm's entire historical case corpus plus comparable verdicts/settlements — letting the firm price contingency risk and prioritize like an entire analytics team that never existed.  
  ↳ *needs:* Embeddings over firm case history + verdict/settlement databases (Jury Verdict Research, Lex Machina-style), outcome-regression model, predicted range surfaced on matter record
- **Real-Time Adverse-Event & Mass-Tort Origination Radar** — Continuously scans FDA recalls, NHTSA actions, news, and regulatory filings to detect emerging mass-tort opportunities the instant they break, then auto-launches a screening campaign and starts qualifying plaintiffs before competing firms have read the headline.  
  ↳ *needs:* Streaming feeds (FDA/NHTSA/SEC/news), event-classification model, auto-generated eligibility decision-tree, instant campaign spin-up with bulk outbound + landing capture
- **Continuous Trust-Accounting & IOLTA Compliance Watchdog** — Monitors every client trust ledger in real time across all matters, flagging negative balances, commingling, or overdraw the instant it could occur — preventing the bar-discipline-grade accounting error that destroys firms, with vigilance no part-time bookkeeper can match.  
  ↳ *needs:* Real-time read of IOLTA/operating ledgers (Clio Manage/QuickBooks), three-way-reconciliation engine, per-matter balance alerts, immutable compliance log for bar audits

## 💰 Killer revenue moves
- After-hours injury-call capture and sub-30-second retainer sign: PI firms bleed 30-50% of leads to voicemail; Gui completes intake, runs conflicts, and fires the e-signed retainer before the competitor's voicemail beeps — each captured PI case is worth $10k-$100k+ in contingency fees, so a single saved 2am call pays for the agent for years.
- SOL-window dormant-lead reactivation blasts: simultaneously re-engaging hundreds of already-paid-for-acquisition leads with personalized 'your time to file is running out' outreach revives cases that were dead money — pure margin recovered from acquisition spend the firm already burned.
- Mass-tort / class eligibility screening and adverse-event origination radar: instantly qualifying thousands of campaign callers AND detecting new mass-tort opportunities the moment a recall breaks lets a firm originate and scale a lucrative MDL/class practice — potentially seven-to-eight figures in aggregate fees — with zero added intake headcount.
- Zero-leak deadline sentinel as malpractice-insurance shield: a single missed SOL or filing deadline is a six-to-seven-figure malpractice claim plus premium spikes; guaranteeing no clock is ever missed across the whole caseload is the 'cannot live without it' insurance the firm will pay anything to keep.
- Collectability + settlement-prediction triage at intake: knowing a defendant's policy limits and a case's likely settlement range before signing stops the firm from sinking thousands into uncollectible or low-value matters and concentrates capacity on the highest-fee cases — directly multiplying revenue per attorney-hour.
- Consult-fee and retainer collection by voice/SMS before the appointment: killing no-shows and converting free consults into paid revenue from minute one, with predictive no-show intervention recovering slots that would otherwise sit empty.

## 🔌 Integrations to connect
- Clio (Manage + Grow API) / PracticePanther / MyCase / Filevine — practice management, matters, contacts, billing, trust ledgers, deadlines
- DocuSign / Dropbox Sign — retainer & engagement-letter e-signature
- Stripe (Payment Links + Terminal) with IOLTA/trust vs operating account routing
- Twilio (Voice, Conversation Relay, SMS) + WhatsApp Business API for omnichannel intake
- Google Calendar / Microsoft Outlook / Calendly — attorney consult scheduling
- NetDocuments / Clio Documents — secure document management and intake uploads
- Google Business Profile + Avvo + Martindale — review generation and reputation
- Lead-source/ad platforms (Google LSA — Local Services Ads, Meta Lead Ads, CallRail) for attribution and call tracking
- Court docket + e-filing feeds (PACER, state court dockets, CourtListener) for deadline and hearing data
- Outcome/analytics data (Lex Machina, Jury Verdict Research, Trellis) for settlement prediction and case valuation
- Adverse-event & regulatory feeds (FDA recalls, NHTSA, SEC EDGAR, news APIs) for mass-tort origination
- Insurance/policy-limit, business-solvency, and asset/lien data sources for collectability scoring
- QuickBooks / Clio Accounting for three-way trust reconciliation and IOLTA compliance monitoring

## 📝 Collect at signup (onboarding)
- Practice areas handled + attorney-to-practice-area mapping (and which the firm refers out)
- Jurisdictions/states the firm practices in (to drive SOL, venue, and bar-advertising rules)
- Fee structures per practice area (contingency %, hourly rates, flat fees, consultation fee — free or paid, and amount)
- Existing client + adverse-party list (for conflicts checking) and practice-management system credentials (Clio/PracticePanther/etc.)
- Intake qualification rules per practice area (what makes a case worth signing vs declining/referring) and the escalation/on-call attorney routing rules
- Retainer/engagement-letter templates, IOLTA trust vs operating account details, and Stripe connection
- Office hours, consult locations (in-office/Zoom), languages served, and the firm's UPL/disclaimer and TCPA consent boilerplate
- Open-matter deadline/docket data + court-system access (PACER/state) so the deadline sentinel can watch every clock from day one
- Trust/operating ledger access (Clio Accounting/QuickBooks) and the firm's three-way-reconciliation cadence for IOLTA monitoring
- Historical case-outcome data (past settlements/verdicts) to seed case-value and settlement-prediction models
