# 💪 Gyms & Fitness — Gui Agent Playbook

> Gui becomes the gym's 24/7 front desk, retention scientist, and sales floor — answering every call, filling every class, charging every card, and saving every member who's about to quit BEFORE they know they're quitting, in EN/PT/ES, while you sleep.

## 🟢 Core (table-stakes)
- **24/7 Call & Text Answering** — Answers every inbound call, SMS and WhatsApp instantly in EN/PT/ES — hours, location, parking, pricing, 'do you have a pool', 'is there a day pass' — so no lead hits voicemail or a busy front desk.  
  ↳ *needs:* Twilio voice number + Conversation Relay → ElevenLabs agent (provision.js buyAndBindNumber); tenant FAQ/knowledge base in biz_* knowledge table
- **Trial / Day-Pass / Tour Booking** — Books free trials, drop-in day passes, and facility tours straight into the class/staff calendar, confirms by SMS, and adds to the member's record.  
  ↳ *needs:* Scheduling motor /api/agent-schedule + biz_appointments RPC; Google Calendar two-way via list_events/create_event; class-vs-staff resource model
- **Class Schedule & Reservation** — Reads live class timetable, tells the caller what's on tonight, reserves a spot in spin/yoga/HIIT, and reports remaining capacity per class.  
  ↳ *needs:* Class schedule table (biz_classes with capacity, instructor, room) + Mindbody/Glofox class API sync; agent-schedule capacity check
- **Membership Sales & Quoting** — Quotes the right plan (month-to-month, annual, family, student, PT add-on), explains joining fees and contract terms, and closes with a payment link.  
  ↳ *needs:* Plan/price catalog in src/data + biz_plans table; Stripe pay-link (functions/api/pay-link) / Mercado Pago PIX for BR
- **Charge & Enroll by Voice/SMS** — Takes the join fee or first month via Stripe link by SMS or card-by-voice, then activates the membership and emails a branded welcome.  
  ↳ *needs:* Stripe payment link + Twilio Pay (card-by-voice); emailTemplates.js welcome template; biz_members status=active write
- **Waitlist Management** — When a class is full, adds the caller to the waitlist and auto-promotes + notifies the next person the instant a spot frees from a cancel.  
  ↳ *needs:* biz_waitlist table + cancel webhook trigger; Twilio SMS notify; FIFO promotion RPC
- **Cancellation & Reschedule Handling** — Lets members cancel or move a class/PT session within policy, frees the spot, triggers waitlist promotion, and logs the reason.  
  ↳ *needs:* agent-schedule reschedule/cancel; cancellation policy window in biz_config; reason capture to call_logs
- **Hours, Access & Logistics Q&A** — Answers 'are you open on the holiday', 'how do I get my keyfob', 'where's guest parking', 'is childcare open now' from the live knowledge base.  
  ↳ *needs:* Per-tenant knowledge base table + holiday/hours override field; staffed-hours vs 24hr-access flag
- **Lead Capture & Routing** — Captures name, phone, goal and source on every inquiry, writes the lead, and routes hot ones (ready-to-join) to a human or instant follow-up.  
  ↳ *needs:* lead.js gui_actions insert (RLS insert-only for anon); CRM webhook; hot/warm scoring field
- **PT / Class-Pack Sales** — Sells personal-training packages and class-packs, matches the member to an available trainer by goal and time, and books the first session.  
  ↳ *needs:* Trainer roster + availability in biz_staff; package catalog; Stripe pay-link; calendar booking
- **Cancellation-Save / Retention Desk** — When a member calls to cancel, Gui hears the reason, counters with a policy-compliant save offer (freeze, downgrade, free PT session, pause), and only processes the cancel if the save fails.  
  ↳ *needs:* Cancel-intent detection in call flow; save-offer matrix in biz_config; freeze/downgrade write to biz_members; reason + outcome logged to call_logs

## 🔵 Advanced (proactive automations)
- **No-Show Win-Back for Trials** — When a booked trial or tour doesn't show, Gui calls/texts within the hour with a warm 'we missed you — want tonight or tomorrow?' and re-books on the spot.  
  ↳ *needs:* Calendar no-show detection cron (CronCreate) + agent outbound call (call.js dial gate) + reschedule RPC
- **Frozen / Paused Membership Recovery** — Tracks members on freeze and, as the unfreeze date nears, proactively reaches out to reactivate before they drift into full cancellation.  
  ↳ *needs:* biz_members freeze_until field + scheduled scan; outbound voice/SMS; reactivation pay-link
- **Failed-Payment Dunning** — On a declined card, Gui texts the member a secure update-card link and follows up by voice if unpaid, recovering revenue without staff chasing.  
  ↳ *needs:* Stripe webhook (invoice.payment_failed) → stripe-webhook.js → Twilio SMS + Stripe billing-portal link; retry ladder cron
- **Class-Fill Optimizer** — Spots under-booked classes 24–48h out and texts members who historically attend that slot/style to fill empty spots before the class runs.  
  ↳ *needs:* Attendance history in biz_attendance + affinity query; outbound SMS campaign via call/text bus; capacity threshold trigger
- **Birthday & Milestone Outreach** — Sends a personal birthday note, a '100th visit' shout-out, or a '1-year strong' message with a small perk — turning data into loyalty.  
  ↳ *needs:* DOB + join_date + visit_count in biz_members; scheduled-tasks cron; emailTemplates + SMS
- **Goal Check-In Cadence** — Following a member's stated goal (lose weight, run 5k, post-natal), Gui checks in at smart intervals, nudges to book, and flags stalls to a trainer.  
  ↳ *needs:* goal + goal_date captured at signup; cadence engine (CronCreate per member); trainer alert webhook
- **Referral Activation** — After a great session or milestone, Gui asks happy members for a referral, sends them a trackable invite link, and credits both sides on join.  
  ↳ *needs:* Referral code table + attribution; Stripe coupon for credit; SMS/WhatsApp share link
- **Review Generation** — Detects a positive sentiment moment (renewal, PR, milestone) and asks that member for a Google review with a one-tap link, lifting local ranking.  
  ↳ *needs:* Sentiment from call_logs + visit triggers; Google review deep-link; throttle to avoid over-asking
- **Waitlist-to-Class-Expansion Signal** — When waitlists repeatedly overflow for a style/time, Gui flags the owner that demand justifies adding a session and drafts the schedule change.  
  ↳ *needs:* Waitlist overflow aggregation; owner alert (PushNotification); schedule-draft to biz_classes
- **Lapsed-Member Reactivation** — Identifies members who stopped showing up (no scan in 21 days) and reaches out with a tailored 'come back' offer before they cancel.  
  ↳ *needs:* Last-visit gap query on biz_attendance; segmented outbound; comeback offer pay-link
- **Annual-Renewal & Contract-Anniversary Capture** — Before an annual contract auto-renews or a term ends, Gui reaches out to lock the renewal, upsell to a better plan, or pre-empt a cancel at the exact decision moment.  
  ↳ *needs:* contract_end / renewal_date in biz_members; renewal cron; upsell offer matrix; Stripe plan-change link
- **Post-Onboarding First-90-Days Retention Sequence** — New members churn most in the first 90 days; Gui runs a structured welcome-to-habit sequence (book your first class, meet your trainer, hit visit #4) proven to set the sticky-habit threshold.  
  ↳ *needs:* join_date trigger + visit_count milestones; per-member cadence (CronCreate); booking nudges via SMS/voice; trainer intro handoff

## 🟣 Superhuman (impossible for a human)
- **Mass Lapsed-Member Win-Back at Once** — Calls and texts all 500+ at-risk/lapsed members simultaneously in a single evening, each with a 1:1 personalized reason-to-return, something no front desk could ever do.  
  ↳ *needs:* call.js dial gate at scale (DNC + per-tenant caps) + batched outbound queue; per-member personalization from full history; Twilio concurrency
- **Churn Prediction & Pre-Save** — Scores every member's churn risk nightly from attendance decay, payment friction, and sentiment, and intervenes BEFORE they decide to quit — not after they ask to cancel.  
  ↳ *needs:* Nightly model over biz_attendance + payment + call_logs sentiment; risk field; auto-trigger save flow
- **No-Show Prediction per Booking** — Predicts which trial/PT/class bookings are likely to no-show and pre-emptively overbooks or sends an extra nudge to protect trainer utilization.  
  ↳ *needs:* No-show model from historical booking outcomes; overbook logic in agent-schedule; targeted reminder cadence
- **Instant Omniscient Member Recall** — On any call recognizes the member by number and instantly knows their plan, last visit, balance, favorite classes, injuries, and trainer — in milliseconds, with perfect memory forever.  
  ↳ *needs:* Caller-ID → biz_members lookup; unified member 360 view; persistent memory across all past calls (call_logs mirror)
- **Self-Optimizing Scripts (Real-Time A/B)** — Runs live A/B tests on its own offers, greetings, and win-back wording across thousands of interactions and auto-adopts the variant that books/closes more.  
  ↳ *needs:* Variant registry + outcome tracking in gui_actions; bandit allocator; per-tenant winner promotion
- **Demand Forecasting for Staffing** — Predicts call volume, class demand, and join surges (New Year, post-holiday, weather, local events) and tells the owner exactly when to add staff or classes.  
  ↳ *needs:* Time-series over historical volume + external signals (calendar, weather, local events API); owner forecast digest
- **Never-Sleeps 3am Conversion** — Closes the impulse 2am 'I need to get in shape' lead — answers, quotes, charges and enrolls them while every competitor's phone rings out.  
  ↳ *needs:* Always-on agent + Stripe pay-link + instant member activation; no human-hours dependency
- **Cross-Member Pattern Intelligence** — Sees patterns no human can: which class an at-risk member must attend to stay, which trainer retains best, which plan churns least — and routes every member to their stickiest path.  
  ↳ *needs:* Cohort analytics across all members/attendance/retention; routing rules fed back into booking + outreach
- **Omni-Channel Memory Continuity** — A member starts on WhatsApp, calls later, texts next week — Gui remembers the whole thread across every channel as one continuous relationship, forever.  
  ↳ *needs:* Unified conversation store keyed to member; channel-agnostic thread merge (Twilio Conversations + call_logs)
- **Real-Time Capacity Yield Pricing** — Sees live class fill and dynamically offers off-peak incentives or premium peak nudges to smooth utilization across the whole timetable, instantly.  
  ↳ *needs:* Live capacity feed + dynamic offer engine; pay-link with variable promo; per-slot yield rules
- **Per-Member Optimal-Contact Engine** — Learns the exact channel, hour, language, tone, and offer-type each individual member responds to — and contacts 5,000 members each on their own perfect terms simultaneously, a personalization depth impossible for any staff.  
  ↳ *needs:* Per-member response model over historical contact outcomes in gui_actions (open/answer/book rates by channel×hour×offer); scheduler that fans out individualized sends via call/SMS/WhatsApp bus
- **Habit-Formation Threshold Intervention** — Knows the precise visit-frequency cliff at which each member's retention collapses (e.g. drops from 3x/wk to 1x/wk) and intervenes in the exact window before the habit breaks — predicting the lapse weeks before a human would notice.  
  ↳ *needs:* Per-member attendance-cadence baseline + deviation detection on biz_attendance; early-warning trigger fires save outreach before risk shows in churn model
- **Continuous Full-Roster Conversation Coverage** — Holds a live, context-aware conversation with every single member of the gym at the same time, 24/7 — every lead, every renewal question, every cancel threat handled in parallel with zero hold time, zero dropped call, infinite simultaneous attention.  
  ↳ *needs:* Stateless agent horizontally scaled on Conversation Relay; Twilio concurrency pool; per-session 360 context hydration; no per-seat human ceiling
- **Lifetime-Value Optimization per Member** — Computes each member's predicted LTV and the single next action (upsell PT, switch to annual, add family member, prevent freeze) that maximizes it, then executes that action automatically across the whole roster — optimizing thousands of individual revenue paths at once.  
  ↳ *needs:* LTV model over plan + tenure + attendance + upsell history; next-best-action policy; auto-execute via pay-link/plan-change + outbound agent; outcome feedback loop
- **Real-Time Sentiment-Triggered Rescue** — Detects the instant a member's tone sours mid-call or mid-text (frustration, disappointment, 'this isn't working') and escalates a tailored rescue offer or human handoff in real time — catching the churn signal at the exact emotional moment, not in a next-day report.  
  ↳ *needs:* Streaming sentiment on Conversation Relay transcript; live trigger threshold; in-call branch to save-offer or PushNotification human handoff; outcome to call_logs
- **Self-Healing Knowledge & Price Sync** — Continuously reconciles its own answers against the live Mindbody/Glofox/Stripe source of truth, so the moment a price, class, instructor sub, or holiday hour changes anywhere, every future call across all channels is already correct — no staff ever updates a script.  
  ↳ *needs:* Scheduled diff of biz_* knowledge/plans/classes vs gym-management + Stripe APIs; auto-write deltas; invalidate cached answers; change log to owner

## 💰 Killer revenue moves
- Churn pre-save engine: nightly churn + habit-threshold scoring with automatic 1:1 save outreach BEFORE members decide to cancel — at $40–120/mo each, saving 15–30 members/month recovers $7k–$40k/yr per gym and is the undisputed 'cannot live without it' feature.
- Cancellation-save desk: every inbound cancel call is intercepted with a freeze/downgrade/free-PT counter instead of a clean termination — converting 25–40% of would-be cancels into retained or paused (recoverable) members at zero staff effort.
- Mass lapsed-member reactivation: call/text every dormant member in one evening with a personalized comeback offer — instantly resurrecting dead revenue already sitting in the database, typically reactivating 5–12% of a lapsed list worth thousands per send.
- Failed-payment dunning recovery: auto-recover declined cards by SMS link + voice follow-up, plugging a silent 5–10% monthly revenue leak (the single largest involuntary-churn source in fitness) with zero staff chasing.
- 24/7 trial-to-paid + 3am impulse closing: every after-hours and overflow lead gets answered, quoted, and charged on the spot — converting today's #1 lost revenue (missed calls and voicemail) directly into paid memberships, recovering 30–50% of leads that currently never convert.
- LTV next-best-action upsell: roster-wide automatic execution of the single highest-LTV move per member (PT pack, annual switch, family add) — compounding ARPU across the entire base without a single sales hire.

## 🔌 Integrations to connect
- Mindbody / Glofox / Wodify / Zen Planner (gym management + class booking + member CRM)
- Stripe (membership billing, pay-links, dunning, billing portal) + Mercado Pago PIX for Brazil
- Twilio (voice number, SMS, WhatsApp Business, Conversation Relay, Twilio Pay card-by-voice)
- ElevenLabs (the Gui voice agent, EN/PT/ES TTS)
- Google Calendar / Google Business Profile (tour & PT scheduling + reviews + hours)
- ClassPass / Gympass / TotalPass (third-party class inventory + drop-in reconciliation)
- Keyfob / access-control systems (Kisi, Brivo, Openpath) for 24hr-access status and check-in scans
- Supabase ynihodbknhjirkdogxby biz_* (members, plans, classes, attendance, waitlist, appointments, call_logs)

## 📝 Collect at signup (onboarding)
- Full class & PT timetable: each class style, instructor, room, day/time, and capacity (so Gui can book and report fill in real time)
- Membership plan catalog: every plan name, price, joining fee, contract term, freeze/cancel policy, and any student/family/corporate tiers
- Trainer & staff roster with specialties, availability, and which can be booked for trials/PT
- Stripe (and PIX) account connected + which products map to which plans, plus failed-payment retry preference
- Gym knowledge base: hours (staffed vs 24hr access), location/parking, amenities (pool, sauna, childcare), guest/day-pass policy, holiday overrides
- Member database import: names, phones, plan, join date, last visit, freeze status, DOB, stated goals, and attendance history (so retention, win-back, churn prediction and habit-threshold detection all work on day one)
- Cancellation/no-show/freeze policies + booking windows + the approved save-offer matrix (freeze, downgrade, free PT, pause) so Gui can run the cancellation-save desk within policy
- Owner's preferred tone (Gui's Four Seasons-concierge persona tuned per brand), phone number(s) to port or provision, preferred languages (EN/PT/ES), and where hot leads / real-time sentiment escalations should route (human handoff number or instant follow-up)
