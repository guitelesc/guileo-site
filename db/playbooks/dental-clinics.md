# 🦷 Dental Clinics — Gui Agent Playbook

> Gui becomes the dental practice's omniscient revenue engine — a never-sleeping front desk, treatment coordinator, recall manager, and insurance strategist that fills every empty chair, closes every diagnosed-but-unscheduled crown, recovers every lapsed patient, and harvests every expiring insurance dollar before the first hygienist clocks in — at a scale and precision no human front desk could ever touch.

## 🟢 Core (table-stakes)
- **24/7 New-Patient Intake** — Answers every call/text/WhatsApp in EN/PT/ES, qualifies the caller (new vs existing, chief complaint, insurance), captures name/DOB/phone/email, and books the right appointment type (exam+cleaning, emergency, consult).  
  ↳ *needs:* Twilio Voice + Programmable Messaging + WhatsApp Business API; STT/TTS voice pipeline; PMS API write (Dentrix/Eaglesoft/Open Dental) or biz_* scheduling motor + /api/agent-schedule bridge
- **Appointment Booking by Procedure Type** — Knows each appointment's real chair-time and required operatory/provider (hygiene 60min, crown prep 90min, new-patient exam 60min) and books only into valid slots with the correct provider.  
  ↳ *needs:* PMS appointment-book API or biz_appointment_types table (duration, provider role, operatory) in Supabase ynihodbknhjirkdogxby; provider schedule sync
- **Insurance Verification at Booking** — Captures carrier, member ID, group number, subscriber DOB; states whether the practice is in-network and what the patient should expect to pay for a cleaning/exam, flagging out-of-network upfront.  
  ↳ *needs:* Eligibility API (Vyne/DentalXChange/Onederful/pVerify) or stored in-network carrier list + fee schedule table; PMS insurance field write
- **Quoting & Treatment Cost Estimates** — Gives ballpark and exact-fee quotes for common procedures (cleaning, crown, root canal, implant, whitening, Invisalign) using the practice's fee schedule and the patient's insurance coverage tier.  
  ↳ *needs:* biz_fee_schedule table (CDT code → cash price + per-carrier allowed amount); insurance coverage % per category
- **Payments: Stripe Link + Card-by-Voice** — Sends a Stripe payment link by SMS/WhatsApp for deposits, copays, or treatment balances, or takes card-by-voice for booking deposits on high-value procedures (implants, ortho).  
  ↳ *needs:* Stripe Payment Links + Twilio <Pay> (PCI-compliant DTMF capture); gui_actions ledger; deposit policy per appointment type
- **Emergency Triage & Routing** — Detects dental emergencies (severe pain, swelling, trauma, knocked-out tooth, post-op bleeding) by keyword/sentiment, gives safe first-aid guidance, and routes to same-day slot or on-call dentist escalation.  
  ↳ *needs:* Triage decision tree; emergency same-day slot reservation logic; on-call escalation phone/SMS via call.js dial gate; sentiment scoring
- **Appointment Reminders & Confirmations** — Sends multi-touch reminders (7-day, 48h, day-of) by SMS/WhatsApp/voice, captures confirm/reschedule/cancel replies, and updates the PMS book in real time.  
  ↳ *needs:* Scheduled task runner (cron); PMS appointment-status write; two-way SMS/WhatsApp threading; emailTemplates.js for email touch
- **Reschedule & Cancellation Handling** — Lets patients reschedule or cancel by voice/text any hour, instantly frees the slot, and offers it to the waitlist — never leaving a hole unmanaged.  
  ↳ *needs:* PMS slot release + waitlist table; biz scheduling motor reschedule endpoint; cancellation-policy fee logic
- **Hours, Location, Directions, Forms** — Answers FAQs (hours, address, parking, accepted insurances, financing, what to bring, new-patient paperwork) and texts a digital intake/health-history form link before the visit.  
  ↳ *needs:* Practice KB (hours/address/insurances/policies); digital forms link (Yapi/Modento/NexHealth) or hosted intake form; SMS link delivery
- **Recall & Hygiene Reminders** — Identifies patients due for their 6-month cleaning and proactively reaches out to book, keeping the hygiene schedule full.  
  ↳ *needs:* PMS recall/last-visit data; biz_patients last_hygiene_date; outbound campaign via call.js (DNC + caps honored)
- **Multilingual Concierge** — Detects and switches between English, Portuguese, and Spanish mid-conversation, matching the patient's language across voice and text.  
  ↳ *needs:* Language-detect in STT; multilingual TTS voices; per-patient language preference stored on biz_patients
- **Lead Capture & Missed-Call Text-Back** — Instantly texts back any missed/abandoned call with a booking link and captures the lead so no ringing phone is ever lost revenue.  
  ↳ *needs:* Twilio missed-call webhook; lead.js (noCall honored); auto-SMS template; CRM/lead table insert

## 🔵 Advanced (proactive automations)
- **Treatment-Plan Follow-Up Closer** — After the dentist diagnoses unscheduled treatment (the crown the patient 'will think about'), Gui follows up over days/weeks by text and call, answers cost/financing objections, and books the procedure.  
  ↳ *needs:* PMS unscheduled-treatment-plan export (treatment-plan API); objection-handling scripts; CareCredit/Sunbit financing link; multi-touch cadence engine
- **Waitlist Auto-Fill (ASAP List)** — When a cancellation opens a slot, Gui instantly calls/texts the ASAP waitlist in priority order and books the first taker, turning gaps into revenue within minutes.  
  ↳ *needs:* Waitlist table with priority + procedure match; real-time slot-open trigger; parallel outbound via call.js; first-to-confirm locking
- **Insurance Maximize-Before-Year-End** — In Q4, contacts patients with unused annual insurance benefits and pending treatment, nudging them to use benefits before they expire Dec 31.  
  ↳ *needs:* Insurance remaining-benefit data (eligibility API) + unscheduled treatment; year-end campaign trigger; personalized benefit-amount messaging
- **Post-Op Check-In** — Texts/calls patients 24–72h after extractions, root canals, or implants to check healing, flag complications for the dentist, and reinforce care instructions.  
  ↳ *needs:* PMS procedure-completed trigger (CDT codes); post-op message templates per procedure; escalation to dentist on red-flag replies
- **Reactivation of Lapsed Patients** — Identifies patients not seen in 9–18 months and runs a warm, personalized win-back sequence referencing their last visit and overdue cleaning.  
  ↳ *needs:* PMS last-visit query; lapsed-patient segment; personalized outbound campaign; DNC/caps via call.js; A/B offer variants
- **Financing & Membership Plan Offers** — When a patient balks at cost or is uninsured, Gui proactively offers CareCredit/Sunbit financing or the practice's in-house membership/savings plan with monthly pricing.  
  ↳ *needs:* CareCredit/Sunbit API or application link; membership-plan terms in KB; in-network vs uninsured logic; Stripe subscription for membership
- **Review Generation Engine** — After a positive-sentiment completed visit, Gui texts a Google/Yelp review request with a direct link, routing unhappy patients to a private feedback path instead.  
  ↳ *needs:* Visit-complete + sentiment trigger; Google review deep-link; sentiment gate; private-feedback capture form
- **Family-Block Scheduling** — Recognizes family accounts and proactively offers to book siblings/spouse back-to-back or same-day to save the household trips and fill multiple chairs.  
  ↳ *needs:* PMS family/guarantor linkage; multi-slot block-booking logic; family-account detection on biz_patients
- **No-Show Recovery Same Day** — The moment a patient no-shows, Gui calls/texts to reschedule immediately while intent is warm, and offers the freed slot to the waitlist in parallel.  
  ↳ *needs:* PMS no-show status webhook; immediate dual-action (recover + backfill); cancellation/no-show fee policy
- **Pre-Appointment Form & Balance Collection** — Before each visit, confirms insurance is still active, sends the health-history update form, and collects any outstanding balance via Stripe link so check-in is frictionless.  
  ↳ *needs:* Eligibility re-check API; digital form link; AR/balance data from PMS; Stripe link; pre-visit cadence trigger
- **Smart Overbooking Suggestions** — Recommends safe double-booking of hygiene/short procedures on historically high-no-show days to protect production without overloading staff.  
  ↳ *needs:* Historical no-show rate by day/slot/patient; production-target model; operatory capacity rules; staff-facing portal alert
- **Referral & Specialist Coordination** — When a case needs an oral surgeon/endodontist/orthodontist, Gui captures the referral, texts the patient the specialist's info, and follows up to confirm they booked.  
  ↳ *needs:* Referral-partner directory; warm-handoff message templates; follow-up loop to confirm specialist booking
- **AR & Aging-Balance Collections** — Works the practice's accounts-receivable aging report autonomously — texts/calls patients with overdue balances on a graduated cadence, offers payment plans, and collects via Stripe link before accounts go to collections.  
  ↳ *needs:* PMS AR aging export (30/60/90/120-day buckets); graduated dunning cadence; Stripe Payment Links + payment-plan / Stripe subscription; gui_actions ledger; collections-handoff threshold
- **Insurance Claim Denial Triage** — Monitors claim statuses, flags denials and aging unpaid claims, drafts the resubmission with the missing info (narrative, X-ray attachment prompt, corrected CDT code), and alerts staff to act — recovering revenue stuck in claim limbo.  
  ↳ *needs:* Clearinghouse claim-status feed (Vyne/DentalXChange); denial-reason code mapping; resubmission draft templates; staff portal alert + attachment request

## 🟣 Superhuman (impossible for a human)
- **Mass Lapsed-Patient Reactivation Blitz** — Simultaneously calls and texts all 500–2000 lapsed patients in one night, each with a 1:1 personalized message citing their last procedure and overdue recall, booking dozens before staff arrive.  
  ↳ *needs:* Full PMS patient export; massively parallel outbound (call.js with DNC + daily caps + TCPA windows); per-patient personalization engine; live booking into biz scheduling motor
- **Omniscient Instant Quoting** — In milliseconds cross-references the caller's exact insurance plan, remaining benefits, the practice's fee schedule, and CDT codes to give a precise out-of-pocket number no human front desk could compute live on the phone.  
  ↳ *needs:* Real-time eligibility API + fee_schedule + coverage-tier tables joined in <1s; CDT-code knowledge base
- **No-Show Prediction & Pre-emptive Backfill** — Scores every upcoming appointment's no-show probability from history, time-of-day, lead-time, and patient pattern, then over-confirms high-risk slots and pre-stages waitlist replacements before the gap happens.  
  ↳ *needs:* ML no-show model on historical appointment outcomes; per-slot risk score; automated extra-confirmation + waitlist pre-stage workflow
- **Self-Optimizing Script A/B Testing** — Continuously runs live A/B/n tests on its own greeting, recall offers, reactivation hooks, and reminder copy across thousands of interactions, auto-promoting the highest-booking variant per language and segment.  
  ↳ *needs:* Variant framework + per-variant conversion tracking in gui_actions; multi-armed-bandit allocator; segment/language stratification
- **Perfect Eternal Patient Memory** — Remembers every patient forever — every call, preference, anxiety (sedation needs), family ties, no-show history, payment behavior — and greets each one with full context across years and channels.  
  ↳ *needs:* Unified patient memory store (biz_patients + call_logs + transcripts in ynihodbknhjirkdogxby); cross-channel identity resolution by phone/email
- **Infinite Simultaneous Line Capacity** — Handles unlimited concurrent calls and texts during a Monday-morning rush or a marketing-spike surge — zero hold music, zero busy signal, zero abandoned calls, ever.  
  ↳ *needs:* Concurrent-session voice infra (Twilio + scalable STT/TTS); stateless per-call agent orchestration; auto-scaling
- **Demand & Capacity Forecasting** — Predicts next month's call volume, hygiene demand, and chair utilization by day/hour from seasonality and patterns, recommending staffing and which days to run reactivation pushes to fill predicted gaps.  
  ↳ *needs:* Time-series forecasting on historical booking/call data; capacity-utilization model; staff-portal forecast dashboard
- **Real-Time Benefit-Expiry Sweep** — On Dec 1, instantly scans the entire active-patient base for unused insurance maximums plus pending treatment and launches mass 1:1 outreach quantifying each patient's exact 'use-it-or-lose-it' dollars.  
  ↳ *needs:* Bulk eligibility query across all patients; unscheduled-treatment join; personalized dollar-amount message generation; mass outbound engine
- **24/7 Multilingual Omnipresence** — Is awake at 2am on a holiday answering an emergency in Portuguese while simultaneously texting a Spanish reactivation and quoting an English implant — never tired, never off, never inconsistent.  
  ↳ *needs:* Always-on infra; multilingual voice/text models; consistent persona enforcement across all concurrent sessions
- **Churn-Risk Early Warning** — Flags patients drifting toward churn (missed recall, ignored reminders, declining engagement, unresolved complaint) before they leave, and triggers a tailored save-offer automatically.  
  ↳ *needs:* Engagement-scoring model across visit/payment/response history; churn-risk threshold triggers; automated retention-offer workflow
- **Whole-Schedule Optimization Overnight** — Each night re-solves tomorrow's entire book — closing gaps via waitlist, clustering families, balancing provider load, and pre-confirming — handing staff a fully optimized day no human could assemble manually.  
  ↳ *needs:* Constraint-solver over operatory/provider/duration rules; overnight batch job; waitlist + reschedule write access to PMS/biz motor
- **Cross-Patient Pattern Mining for Revenue** — Mines the entire patient base to surface untapped revenue — everyone overdue for whitening, all sleep-apnea/night-guard candidates, lapsed ortho consults — and runs targeted campaigns automatically.  
  ↳ *needs:* Procedure-history + demographic mining across full PMS dataset; opportunity-segment generator; auto-campaign launcher with attribution
- **Mass Treatment-Plan Resurrection Engine** — Continuously works EVERY open unscheduled treatment plan across the entire patient base in parallel — thousands of dollars of diagnosed-but-unbooked crowns, implants, and ortho — running personalized multi-week, multi-channel closing cadences on all of them at once, something no human coordinator could track past a handful of cases.  
  ↳ *needs:* Full PMS treatment-plan-pending export (CDT codes + estimated production $); per-plan financing/objection scripting; parallel multi-touch cadence engine; live booking; gui_actions attribution of recovered production
- **Real-Time Chair-Utilization Yield Optimizer** — Watches the live schedule like an airline yield system — the moment open chair-time is detected within the next 24–72h, it instantly identifies the highest-production candidate (waitlist, lapsed, pending treatment) who fits that exact slot/provider and books them, dynamically maximizing revenue-per-chair-hour in real time.  
  ↳ *needs:* Live schedule feed + slot-gap detection; production-value ranking across candidate pools; provider/operatory/duration match; instant parallel outbound + first-to-confirm lock
- **Predictive Recall Pre-Booking** — Forecasts each patient's individual return-likelihood and ideal recall timing from their personal visit cadence, then reaches out at the precise moment they're most likely to book — pre-filling the hygiene schedule weeks ahead of when a human would even pull the recall list.  
  ↳ *needs:* Per-patient visit-cadence model + recall-interval prediction; optimal-contact-timing model; automated outbound trigger; biz scheduling motor pre-book
- **Live Insurance-Plan Intelligence Network** — Across the entire multi-tenant patient base, learns the real-world behavior of every insurance plan — actual allowed amounts, denial patterns, downgrade quirks, processing times — and uses that collective intelligence to quote and pre-empt denials more accurately than any single practice's experience ever could.  
  ↳ *needs:* Aggregated cross-tenant claim-outcome + EOB data (anonymized) in ynihodbknhjirkdogxby; per-plan behavior model; privacy/compliance isolation; quote + denial-prediction engine
- **Emergency Triage Network Routing** — At any hour, simultaneously triages multiple incoming emergencies, ranks each by clinical urgency from symptom+sentiment analysis, and routes each to the optimal same-day slot or on-call provider across all locations at once — never making a bleeding patient wait on hold.  
  ↳ *needs:* Multi-session concurrent triage; clinical-urgency scoring model; cross-location same-day slot map; on-call provider routing via call.js; severity-ranked queue
- **Sentiment-Driven Anxiety Concierge** — Detects dental anxiety in real time from voice tone and word choice on every call, automatically adapts its pacing and reassurance, flags the chart for sedation/extra-time needs, and pre-warns the clinical team — at scale across every nervous patient simultaneously.  
  ↳ *needs:* Real-time voice sentiment/anxiety detection; adaptive conversation policy; biz_patients anxiety/sedation flag write; pre-visit clinical-team alert

## 💰 Killer revenue moves
- Mass Treatment-Plan Resurrection: relentlessly working EVERY open unscheduled treatment plan in the practice in parallel — the crowns, implants, root canals, and ortho cases worth thousands each that patients 'thought about' and never booked. This is the single largest pool of already-diagnosed, already-wanted revenue sitting dead in the PMS, and recovering even a fraction of it is tens to hundreds of thousands in production no human coordinator could chase at that scale.
- Mass overnight lapsed-patient reactivation: calling + texting hundreds-to-thousands of dormant patients in one night with 1:1 personalization, refilling the schedule at near-zero marginal cost — the biggest, fastest dollar swing a practice can make.
- Real-time chair-utilization yield optimization: treating every open chair-hour like an airline seat — instantly backfilling every cancellation, no-show, and gap with the highest-production candidate who fits, converting otherwise-dead chair time directly into same-day production all day, every day.
- Q4 insurance benefit-expiry sweep: scanning the entire base on Dec 1 and telling each patient their exact 'use-it-or-lose-it' dollars plus pending treatment, driving a December production surge worth tens of thousands that simply does not happen with a human front desk.
- Autonomous AR + denied-claim recovery: working the aging-balance report and stuck insurance claims to pull cash that's already owed back into the practice — recovering money that would otherwise be written off or sent to collections.

## 🔌 Integrations to connect
- Practice Management Systems: Open Dental (open API), Dentrix / Dentrix Ascend, Eaglesoft, Curve Dental, Denticon — appointment book, patient records, treatment plans, recall, AR
- NexHealth Synchronizer (universal PMS read/write API) as a write bridge to legacy systems
- Insurance eligibility & verification: Vyne Trellis, DentalXChange, Onederful, pVerify, Availity — plus claim-status / denial feeds for AR and claim-denial triage
- Payments & financing: Stripe (Payment Links + <Pay> card-by-voice + subscriptions for membership plans + payment plans), CareCredit, Sunbit, Cherry
- Communication: Twilio Voice / Programmable Messaging / WhatsApp Business API; SendGrid for email
- Digital forms & engagement: Modento, Yapi, NexHealth, Weave (intake/health-history, two-way patient messaging)
- Reviews & reputation: Google Business Profile API, Yelp, Birdeye
- Calendar / provider scheduling sync: Google Calendar (mcp__7c16b740 create/list/update events) for provider blocks
- Supabase ynihodbknhjirkdogxby (biz_* scheduling motor, patients, fee schedule, AR/balances, treatment-plan pipeline, call_logs, transcripts) as the owned data + booking backbone

## 📝 Collect at signup (onboarding)
- Practice profile: legal + display name, address(es), phone/SMS number to port or forward, hours per location, time zone, languages to support (EN/PT/ES)
- PMS in use + API credentials / NexHealth connection, plus provider roster (dentists, hygienists) with each one's working hours, operatories, and which procedures they perform
- Appointment-type catalog: each type's chair-time duration, required provider role, operatory, and any required deposit (e.g. implant/ortho consult deposit)
- Fee schedule by CDT code (cash price) + accepted insurance carriers, in-network status per carrier, and coverage tiers/copays for common categories
- Policies: cancellation/no-show fee, deposit rules, recall interval (6-month default), emergency same-day handling, on-call dentist escalation number, and AR/collections dunning cadence + write-off threshold
- Financing & membership: CareCredit/Sunbit merchant IDs, in-house membership plan tiers + pricing, Stripe account connection
- Patient base export for day-one reactivation/recall AND treatment-plan resurrection: names, phones, emails, last-visit dates, language, insurance + remaining benefits, outstanding AR balances, all open unscheduled treatment plans (CDT + estimated production $), and DNC flags
- Brand voice + persona settings: greeting script, practice tone (warm/concierge), anxiety-handling preferences, review platform links (Google/Yelp), and FAQ knowledge (parking, what to bring, financing, accepted insurances)
