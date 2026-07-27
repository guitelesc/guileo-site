# 🏥 Medical Clinics — Gui Agent Playbook

> Gui becomes the clinic's entire patient-facing operation in one — front desk, recall nurse, after-hours triage line, and revenue-cycle engine — answering every patient 24/7 in EN/PT/ES, filling every empty chair the instant it opens, verifying every insurance before the visit, and never letting a no-show, denied claim, unpaid balance, or lapsed patient slip through again.

## 🟢 Core (table-stakes)
- **24/7 appointment booking** — Answers every call/text/WhatsApp and books, reschedules, or cancels visits by provider, visit type (new patient, follow-up, annual physical, sick visit), and duration directly into the clinic's live calendar with correct slot rules.  
  ↳ *needs:* Calendar API (Google Calendar mcp / biz_* scheduling engine + /api/agent-schedule bridge); per-provider availability, visit-type durations, buffer rules in Supabase biz_services
- **Insurance & cost questions** — Tells patients which insurance plans the clinic accepts, copay/self-pay prices for common visits, and whether a provider is in-network before they book, in their language.  
  ↳ *needs:* Structured insurance-accepted list + self-pay fee schedule in biz_pricing; eligibility lookup integration (Availity/Change Healthcare API) for real-time plan check
- **New-patient intake** — Collects name, DOB, phone, reason for visit, insurance member ID, and pharmacy, then texts the digital intake/consent forms link so the patient arrives ready.  
  ↳ *needs:* Intake form provider (JotForm/IntakeQ/Phreesia link); EHR patient-create API; SMS link via Twilio; gui_actions insert
- **Appointment confirmations & reminders** — Sends multi-touch reminders (text/WhatsApp/call) at 72h/24h/2h, confirms via reply, and auto-opens the slot the instant a patient cancels.  
  ↳ *needs:* Scheduling engine event hooks; Twilio SMS/WhatsApp; reminder cron (CronCreate); two-way reply parsing into call_logs
- **Prescription refill triage** — Captures refill requests (drug, pharmacy, last fill date), routes them to the right provider's queue, and texts the patient once approved or if a visit is required first.  
  ↳ *needs:* EHR refill/task API or secure provider queue table; pharmacy field capture; provider notification route
- **Triage & routing to the right care** — Asks structured symptom questions, flags red-flag emergencies ('call 911 / go to ER'), and routes urgent vs routine to same-day, telehealth, or next available correctly.  
  ↳ *needs:* Clinic-approved triage protocol/decision tree (provider-signed); emergency-escalation script; warm-transfer line to nurse
- **Telehealth scheduling & links** — Books virtual visits, sends the video link by SMS/email, and reminds the patient how to join 10 minutes prior.  
  ↳ *needs:* Telehealth platform API (Doxy.me/Zoom Healthcare/EHR-native); link generation + SMS delivery
- **Billing & balance questions** — Looks up a patient's outstanding balance, explains the charge, and sends a Stripe pay-by-text link or takes card-by-voice to collect it.  
  ↳ *needs:* EHR/PM billing balance API; Stripe payment link + card-by-voice (Twilio <Pay> / Stripe); HIPAA-safe PCI handling
- **Hours, location, directions, parking** — Answers practical logistics — office hours, address, parking, which entrance, what to bring, fasting instructions — instantly any hour.  
  ↳ *needs:* Clinic profile/knowledge base (biz_profile); per-visit-type prep instructions
- **Waitlist capture** — When no desired slot exists, adds the patient to a smart waitlist and offers earlier openings the moment one frees up.  
  ↳ *needs:* Waitlist table in Supabase; cancellation event trigger; outbound offer call/SMS via call.js gate
- **Multilingual reception** — Detects and converses fully in English, Portuguese, or Spanish across voice and text, matching the patient's language automatically.  
  ↳ *needs:* Multilingual voice model (EN/PT/ES) + language-detect; localized scripts/templates

## 🔵 Advanced (proactive automations)
- **Proactive recall outreach** — Spots patients overdue for annual physicals, chronic-care follow-ups, labs, or vaccines and calls/texts them to book the visit they forgot they needed.  
  ↳ *needs:* EHR recall/registry data (last visit, due dates, problem list); outbound dial gate (call.js DNC+caps); recall rules per visit type
- **Same-day cancellation backfill** — The second a slot opens, Gui auto-dials the ranked waitlist and recall pool until the chair is filled — turning dead time into revenue without staff lifting a finger.  
  ↳ *needs:* Real-time cancel webhook; ranked waitlist; parallel outbound via call.js; instant rebook into scheduling engine
- **Pre-visit insurance eligibility check** — Before each upcoming appointment, verifies the patient's coverage is active, flags deductible/copay, and texts the patient their expected cost so there are no front-desk surprises.  
  ↳ *needs:* Eligibility API (Availity/pVerify/Change Healthcare); appointment-ahead cron; SMS cost notice
- **No-show win-back** — Automatically reaches missed-appointment patients within minutes with a warm rebook offer, recovering visits that normally vanish.  
  ↳ *needs:* EHR no-show status feed; immediate outbound; rebook flow; soft no-show-fee mention if policy set
- **Post-visit follow-up & care adherence** — Calls/texts after a visit to confirm the patient filled their prescription, booked ordered labs/specialist referrals, and feels better — nudging the ones who didn't.  
  ↳ *needs:* Visit-complete + orders feed from EHR; pharmacy fill check; referral-status tracking; follow-up cadence cron
- **Reputation & review capture** — After a positive visit, asks the happy patient for a Google review with a direct link; routes unhappy sentiment privately to the manager instead.  
  ↳ *needs:* Sentiment from call transcript (call_logs sentiment); Google review link; manager alert route; negative-feedback containment
- **Referral & specialist coordination** — When a provider orders a referral, Gui calls the specialist to book, sends records, and keeps the patient informed of date/time.  
  ↳ *needs:* Referral order feed; specialist contact directory; records-transfer (fax/Direct/EHR); patient update SMS
- **Pre-appointment prep enforcement** — For visits needing fasting, med-holds, bowel prep, or paperwork, Gui calls/texts the specific instructions and confirms the patient understood and will comply.  
  ↳ *needs:* Per-visit-type prep rules; confirmation capture; flag non-compliant patients to staff
- **Smart overflow & after-hours nurse line** — Handles all overflow when the front desk is slammed and the full after-hours line, escalating only true emergencies to the on-call provider.  
  ↳ *needs:* Overflow detection / forwarding; on-call schedule; warm-transfer + escalation protocol
- **Recurring chronic-care scheduling** — For diabetic, hypertensive, or therapy patients, auto-books the next visit in the series and keeps the cadence so care never lapses.  
  ↳ *needs:* Care-plan cadence rules per condition; series-booking in scheduling engine; chronic registry
- **Prior-authorization chasing** — When a visit, imaging order, or med needs prior auth, Gui submits it, tracks the payer's status daily, and escalates stalls so the patient isn't stuck waiting weeks.  
  ↳ *needs:* Payer prior-auth portal/API (CoverMyMeds, payer EDI 278); order feed from EHR; status-poll cron; staff escalation route
- **Outstanding-balance recovery campaigns** — Runs gentle, compliant multi-touch outreach on aging patient balances with pay-by-text links and self-pay plan offers before accounts go to collections.  
  ↳ *needs:* AR aging feed from PM system; Stripe payment links + installment plans; FDCPA/TCPA-compliant cadence; call.js DNC gate

## 🟣 Superhuman (impossible for a human)
- **Mass simultaneous recall blitz** — Calls all 500+ lapsed/overdue patients at once in a single afternoon — something no front desk could do in a month — each in their own language with their own due-care reason.  
  ↳ *needs:* Parallel outbound dialer (call.js with caps/DNC); full patient registry; per-patient personalization engine; throughput orchestration (relay agents)
- **Instant insurance + price omniscience** — In milliseconds cross-references the patient's plan against every accepted payer, the full fee schedule, and live eligibility to quote exact out-of-pocket — faster and more accurate than any biller.  
  ↳ *needs:* Real-time eligibility API + complete fee schedule + accepted-payer matrix indexed in Supabase
- **No-show prediction & preemptive overbooking** — Scores every upcoming appointment's no-show risk from history, lead time, weather, day-of-week, and insurance type, then preemptively double-confirms or strategically overbooks high-risk slots to protect revenue.  
  ↳ *needs:* Historical no-show dataset; ML risk model; weather API; scheduling engine overbook rules; targeted confirmation cadence
- **Demand & staffing forecasting** — Predicts call volume and visit demand by hour/day/season (flu surges, allergy season, post-holiday) and tells the owner exactly when to add provider hours or block time.  
  ↳ *needs:* Historical visit + call volume data; seasonality/epidemiology signals; forecasting model; owner dashboard alerts
- **Self-optimizing scripts (live A/B)** — Continuously A/B tests its own greeting, recall pitch, and rebook offers across thousands of interactions and auto-adopts the version that books the most patients — improving conversion every week with zero human tuning.  
  ↳ *needs:* Script variant engine; per-variant booking-conversion tracking in call_logs; auto-promotion logic
- **Perfect perpetual patient memory** — Remembers every patient's history, language, preferred provider, pharmacy, anxieties, and prior conversations forever, so every call feels like talking to someone who has known them for years.  
  ↳ *needs:* Persistent per-patient profile store keyed across calls; transcript history; preference graph
- **Real-time multi-channel presence** — Holds hundreds of concurrent phone, SMS, and WhatsApp conversations at the exact same instant with zero hold time, ever — no busy signal, no voicemail, no queue.  
  ↳ *needs:* Concurrent session infra (Twilio + voice relay); stateless-per-call orchestration; multi-tenant isolation
- **Churn-risk patient rescue** — Detects patients drifting away (missed recalls, declining visit frequency, negative sentiment) and launches personalized win-back outreach before they silently switch clinics.  
  ↳ *needs:* Churn-signal model over visit cadence + sentiment; win-back campaign engine; outbound dial gate
- **Continuous denial-pattern watch** — Watches eligibility responses across all patients to flag plans/codes that will likely deny, alerting the biller to fix issues before claims are submitted — preventing denials no human is watching for in real time.  
  ↳ *needs:* Eligibility + claims-status data feed; pattern detection; biller alerting
- **Instant after-hours triage at infinite scale** — Every patient who calls at 2am gets immediate, protocol-perfect triage and same-night guidance simultaneously, with consistent safety escalation no tired human could match.  
  ↳ *needs:* Provider-signed triage protocol; emergency escalation; concurrent session infra; on-call routing
- **Real-time schedule-Tetris optimization** — Continuously re-solves the entire week's calendar across all providers — micro-shuffling, batching same-visit-types, collapsing gaps, and offering patients better slots — to squeeze maximum billable visits out of every provider-hour, recomputed every time anything changes.  
  ↳ *needs:* Full multi-provider schedule state; constraint-solver/optimization engine; patient-preference + acceptance model; live rebook offers via scheduling engine
- **Population health gap-closure engine** — Scans the entire panel against every quality measure (HEDIS/MIPS: overdue mammograms, A1c checks, colon screens, well-child visits, vaccines) and autonomously books the exact patients needed to close each care gap and capture value-based-care bonuses no staff has time to chase.  
  ↳ *needs:* Full registry + problem list + last-service dates; quality-measure rule set (HEDIS/MIPS); gap-to-patient mapping; outbound booking at scale
- **Epidemic-aware surge pre-positioning** — Watches local CDC/flu/RSV/COVID surveillance signals and the clinic's own incoming symptom mix in real time, then preemptively opens sick-visit capacity, pre-orders supply alerts, and shifts the script before the wave hits — staying ahead of demand no human can see coming.  
  ↳ *needs:* Public-health surveillance feeds (CDC FluView, regional dashboards) + WebSearch; live symptom-trend aggregation from call_logs; capacity-open rules; owner alerting
- **Autonomous revenue-cycle closed loop** — Runs the full money loop with zero human touch: pre-verifies eligibility, predicts and prevents denials, collects copays at booking and balances by text, chases prior auths, and reconciles what each visit actually paid — turning the clinic's leakiest process into an always-on machine.  
  ↳ *needs:* Eligibility + claims-status + AR feeds; prior-auth API; Stripe collection; reconciliation logic; denial-prevention model; owner-facing collected-per-visit dashboard
- **Every-call clinical-safety net & documentation** — Listens to and structures every single patient interaction simultaneously — extracting symptoms, drug-allergy and interaction flags, missed red-flags, and a clean structured summary into the chart — auditing 100% of contacts for safety, which no human team could ever review.  
  ↳ *needs:* Real-time transcript NLP; drug/allergy interaction knowledge base; red-flag rule set; EHR note write-back (FHIR); provider review queue for flags
- **Whole-panel multilingual personalization at scale** — Simultaneously runs thousands of individually-tailored outreach conversations — each in the patient's language, tuned to their literacy, anxieties, and history — so every single patient gets concierge-grade attention at once, impossible for any sized staff.  
  ↳ *needs:* Per-patient profile + language + sentiment graph; multilingual generation; mass concurrent session infra; personalization engine

## 💰 Killer revenue moves
- No-show recovery + same-day cancellation backfill: a clinic losing 15-20 visits/week at $150-300 each recaptures $120K-250K/year of otherwise-vanished revenue — every refilled chair is 100% margin because the provider, room, and overhead are already paid for.
- Mass recall + population-health gap-closure blitz: reactivating hundreds of lapsed/overdue patients into the highest-margin visits (physicals, chronic follow-ups, screenings) AND closing HEDIS/MIPS gaps unlocks both per-visit revenue and five-to-six-figure value-based-care quality bonuses staff never have time to chase — often the single largest dollar line.
- Autonomous revenue-cycle closed loop: pre-visit eligibility + denial prevention + prior-auth chasing + copay-at-booking + pay-by-text balance recovery together stop 5-12% claim-denial leakage and slash uncollected patient AR — lifting net collected per visit and recovering balances that used to be written off to collections.
- 24/7 capture of after-hours, overflow, and missed calls: every missed call is a lost (often brand-new) patient worth $2K-10K+ in lifetime value; capturing the 20-40% of calls that hit voicemail today is the highest-ROI new-patient acquisition channel the clinic isn't currently buying.
- No-show prediction + preemptive overbooking + schedule-Tetris optimization: squeezing maximum billable visits out of every paid provider-hour raises utilization a few points across every provider every day — compounding into one of the largest recurring revenue gains with zero added staff or marketing spend.

## 🔌 Integrations to connect
- EHR/Practice Management API (Epic, Athenahealth, eClinicalWorks, DrChrono, NextGen, Kareo/Tebra) for patients, schedule, orders, balances, and FHIR note write-back
- Real-time insurance eligibility + claims status (Availity, Change Healthcare, pVerify, Stedi) for coverage, copay/deductible, and denial-pattern detection
- Prior-authorization automation (CoverMyMeds, payer EDI 278 portals) for med/imaging/visit auth submission and tracking
- Scheduling engine (Guileo biz_* in Supabase + /api/agent-schedule bridge) or Google Calendar API for live booking and multi-provider optimization
- Twilio (Voice, SMS, WhatsApp Business API, <Pay>) for omnichannel conversations and card-by-voice
- Stripe for pay-by-text links, copay-at-booking, installment plans, and balance recovery (HIPAA-aware setup)
- Telehealth platform (Doxy.me, Zoom for Healthcare, or EHR-native video) for virtual visit links
- Digital intake/forms (Phreesia, IntakeQ, JotForm HIPAA) for new-patient and consent paperwork
- Quality-measure / population-health data (HEDIS/MIPS registries, payer value-based-care portals) for care-gap closure and bonus capture
- Public-health surveillance feeds (CDC FluView, regional respiratory dashboards) + WebSearch for epidemic-aware surge pre-positioning
- Google Business Profile API for reviews + directions; e-prescribe/pharmacy directory (Surescripts) for refill routing

## 📝 Collect at signup (onboarding)
- Provider roster with each provider's visit types, slot durations, buffers, and weekly availability
- Complete service + self-pay fee schedule and the full list of accepted insurance plans/payers per provider
- EHR/PM system name + API credentials, eligibility clearinghouse login, and prior-auth portal access for live read/write across schedule, orders, balances, and claims
- Clinic profile: hours, address, parking, what-to-bring, and per-visit-type prep instructions (fasting, med-holds, paperwork)
- Provider-signed triage/escalation protocol, on-call schedule, and the warm-transfer/emergency number
- Cancellation/no-show + recall policy (recall intervals per visit type, no-show fee if any), preferred reminder cadence/channels, and patient-balance/collections outreach rules (TCPA/FDCPA compliance settings)
- Quality-program enrollment (HEDIS/MIPS/value-based contracts) with target measures, plus historical no-show and visit/call-volume data for prediction and forecasting models
- Stripe account + telehealth platform + intake-form provider links, and the clinic's EN/PT/ES language preferences and voice/persona choice
