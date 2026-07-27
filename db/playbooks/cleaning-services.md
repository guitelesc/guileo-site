# 🧽 Cleaning Services — Gui Agent Playbook

> Gui becomes the cleaning company's never-sleeping front desk, dispatcher, quote machine, and growth engine — turning every missed call into a booked, prepaid, route-optimized job, and every idle slot into recovered revenue, at a scale and speed no human team could touch.

## 🟢 Core (table-stakes)
- **24/7 call & text answering** — Answers every inbound call, SMS, and WhatsApp in EN/PT/ES instantly, never sends a cleaning lead to voicemail. Greets with the company name, captures name, address, and reason for calling.  
  ↳ *needs:* Twilio Voice + Programmable Messaging + WhatsApp Business API; Conversation Relay for low-latency voice; lead.js to log every contact
- **Instant square-footage quote** — Quotes standard/deep/move-out cleans by asking bedrooms, bathrooms, sqft, pets, and frequency, then applies the owner's price grid (e.g. $0.10/sqft, +$50/bathroom, +25% deep clean) and reads back a firm price.  
  ↳ *needs:* Owner price-rules table in Supabase biz_pricing; quote engine route /api/agent-quote; sqft lookup via address (county assessor/Zillow API optional)
- **Online-style booking by voice/text** — Books a specific date and 2-hour arrival window into the right crew's calendar, checks crew availability and zip coverage before confirming, and holds the slot.  
  ↳ *needs:* Scheduling engine biz_* + /api/agent-schedule; Google Calendar / Jobber / Housecall Pro calendar sync; crew zip-coverage table
- **Recurring plan setup** — Sets up weekly/biweekly/monthly recurring cleans with the discount tier, auto-creating the full series of future appointments and the billing cadence.  
  ↳ *needs:* Recurring-series logic in scheduling engine; Stripe subscription/recurring; biz_recurring table
- **Quote-to-deposit charging** — Sends a Stripe payment link by SMS for the deposit or full amount, or takes a card by voice, and only confirms the booking once payment clears.  
  ↳ *needs:* Stripe Payment Links + Twilio Pay (PCI voice capture); call.js dial gate; webhook to mark booking paid
- **Reschedule & cancel handling** — Lets a customer move or cancel a clean, enforces the cancellation/late-fee policy, frees the slot back to the crew, and offers the next open window.  
  ↳ *needs:* Scheduling engine reschedule/cancel; biz_policies (notice window, fees); Stripe for fee capture
- **Service-area & service-type gating** — Checks the address zip against the coverage map and the request against offered services (no carpet shampoo, no biohazard, etc.), politely declining or referring out-of-scope jobs.  
  ↳ *needs:* biz_coverage zips + biz_services catalog; geocoding API
- **FAQ & trust answers** — Answers do-you-bring-supplies, are-you-insured/bonded, do-I-need-to-be-home, pet/eco-product, key/lockbox, and arrival-window questions from the owner's knowledge base.  
  ↳ *needs:* Per-tenant FAQ/knowledge table in Supabase; retrieval into the voice prompt
- **Automated confirmations & reminders** — Sends booking confirmation immediately and a reminder 24h and 2h before with the arrival window, crew name, and prep checklist (clear counters, secure pets).  
  ↳ *needs:* Twilio scheduled SMS/WhatsApp; emailTemplates.js for email; CronCreate for reminder jobs
- **Post-clean follow-up & review request** — Texts after the job to confirm satisfaction and, if happy, drops a one-tap Google review link; if unhappy, escalates to the owner instead of the public review.  
  ↳ *needs:* Job-complete webhook from field app; Google review link; sentiment branch; owner alert via PushNotification
- **Lead capture & callback** — If a caller is just shopping, captures contact + scope and books a follow-up, never losing the lead to a competitor.  
  ↳ *needs:* lead.js with noCall honoring; gui_actions insert; callback scheduling via call funnel
- **Live owner/crew escalation** — Warm-transfers or notifies the owner for edge cases (complaints, custom commercial bids, emergencies) with a full text summary of the conversation.  
  ↳ *needs:* Twilio call transfer; call_logs transcript mirror; PushNotification/SMS to owner

## 🔵 Advanced (proactive automations)
- **Dynamic surge & off-peak pricing** — Quotes higher for same-day/weekend/move-out-season demand and offers a discount to fill a slow Tuesday, maximizing revenue per slot automatically.  
  ↳ *needs:* Demand signal from calendar fill-rate; pricing-rules engine with day/lead-time modifiers
- **Crew route-aware scheduling** — When booking, steers the customer toward a date/window where a crew is already nearby, cutting drive time and squeezing extra jobs into a day.  
  ↳ *needs:* Crew geo + existing-jobs data; Google Maps Distance Matrix; route-optimization in scheduler
- **Smart upsell at booking** — Offers relevant add-ons (inside fridge, oven, windows, baseboards, laundry) based on home type and the season, increasing average ticket without feeling pushy.  
  ↳ *needs:* Add-on catalog + attach-rate logic; pricing engine; conversation prompt rules
- **Recurring-to-deep nudge** — Tracks how long since each recurring client's last deep clean and proactively offers a quarterly deep clean at the right moment.  
  ↳ *needs:* Per-customer service history; CronCreate; outbound call/text via call funnel
- **Waitlist auto-fill on cancellation** — When a clean cancels, instantly texts the waitlist and earlier-requested customers to grab the freed slot, so revenue isn't lost.  
  ↳ *needs:* Waitlist table; cancellation webhook; mass-SMS via Twilio; first-come booking lock
- **No-show / lockout fee automation** — Detects a lockout or no-access event from the crew, applies the trip fee per policy, charges the card on file, and reschedules.  
  ↳ *needs:* Crew app event; Stripe saved card; biz_policies fee rules
- **Insurance/COI handling for commercial** — For office/Airbnb/property-manager clients, collects requirements and auto-issues the certificate-of-insurance request and W-9, removing owner admin.  
  ↳ *needs:* Doc-request templates in emailTemplates.js; insurer/COI provider API or PDF; client doc store
- **Supply & seasonal demand alerts** — Warns the owner when bookings outpace crew capacity for an upcoming week or when spring-cleaning demand is spiking, so they staff/buy ahead.  
  ↳ *needs:* Forecast on booking velocity; PushNotification; owner dashboard widget
- **Win-back of lapsed clients** — Notices a former recurring client who stopped and reaches out with a tailored 'we miss you' offer referencing their old schedule.  
  ↳ *needs:* Churn detection on history; outbound call funnel; personalized offer codes via Stripe
- **Referral engine** — After a great review, asks the happy client to refer a friend and sends a trackable referral credit link, turning satisfaction into pipeline.  
  ↳ *needs:* Referral code generation; Stripe credit; SMS link; attribution table
- **Photo-based instant deep-clean quote** — Lets a prospect text photos of the space; Gui estimates condition/scope and returns a firmer deep/move-out quote than blind sqft.  
  ↳ *needs:* WhatsApp/MMS image intake; vision model (generate/analyze); quote engine
- **Gate code & access vault** — Securely stores gate codes, lockbox combos, alarm codes, parking notes per address and hands them to the assigned crew at job time only.  
  ↳ *needs:* Encrypted per-job access fields; RLS-protected store; crew app delivery
- **Property-manager portfolio autopilot** — For property managers and Airbnb hosts with many units, manages turnover cleans across the whole portfolio — auto-books the same-day turn the moment a checkout is detected, tracks per-unit history, and consolidates billing.  
  ↳ *needs:* PMS/Airbnb iCal + webhook checkout signal; multi-unit account model; Stripe consolidated invoicing; per-unit history store
- **Move-out / realtor pipeline capture** — Targets realtors, property managers, and apartment complexes as repeat referrers — recognizes a move-out request, captures the agent's info, and sets up a standing preferred-vendor relationship with bulk pricing.  
  ↳ *needs:* Account/relationship table; preferred-vendor pricing tier; outbound nurture via call funnel; partner attribution

## 🟣 Superhuman (impossible for a human)
- **500-at-once reactivation blitz** — Simultaneously calls and texts every lapsed and one-time customer in the database in one afternoon, each in their language with their name and last service, booking re-cleans at machine scale no human team could dial.  
  ↳ *needs:* Bulk outbound via call funnel + caps/DNC gate; per-customer personalization from history; Twilio concurrency
- **Millisecond omniscient quoting** — Cross-references the address's sqft, prior jobs at that home, the price grid, current crew load, and competitor rates in milliseconds to give the optimal price the instant a caller finishes the sentence.  
  ↳ *needs:* Indexed Supabase joins; assessor/Zillow API; pricing engine; cached competitor data
- **Predictive no-show scoring** — Scores each upcoming booking's no-show/cancel risk from history, lead time, payment status, and weather, and pre-emptively over-books or adds a deposit only for risky jobs.  
  ↳ *needs:* ML scoring on booking features; weather API; dynamic deposit rule in Stripe flow
- **Churn prediction & save** — Predicts which recurring clients are about to quit (skip patterns, slower replies, complaints) weeks ahead and auto-launches a personalized save offer before they ever call to cancel.  
  ↳ *needs:* Behavioral churn model on call_logs + history; outbound funnel; offer engine
- **Self-optimizing scripts (live A/B)** — Continuously runs A/B tests on its own greetings, quote phrasing, and upsell lines across thousands of calls, keeping whatever books and charges more — improving conversion every single day.  
  ↳ *needs:* Script-variant table; per-variant outcome logging in gui_actions; bandit optimizer
- **Mass 1:1 personalized outreach** — Sends thousands of individually unique messages — referencing each home's rooms, pets named, last clean date, preferred crew — at a personalization depth impossible to do by hand for even ten clients.  
  ↳ *needs:* Per-customer profile store; template+merge engine; Twilio/WhatsApp/email at scale
- **Perfect eternal memory** — Remembers every customer forever — their allergies, the dog that bites, which products they hate, the broken vase incident, exact preferences — and applies it on every future call instantly, with zero turnover loss.  
  ↳ *needs:* Permanent per-customer memory in Supabase; retrieval into every conversation; RLS isolation
- **Demand & capacity forecasting** — Forecasts next month's booking volume by zip and service type and tells the owner exactly how many crews and supplies to have, weeks before demand hits.  
  ↳ *needs:* Time-series forecast on booking history + seasonality + local events; owner dashboard
- **Real-time citywide route brain** — Recomputes the optimal job sequence for every crew the moment any booking, cancel, or traffic change happens, something no dispatcher could re-solve continuously all day.  
  ↳ *needs:* Live calendar + Google Maps traffic API; continuous route solver; crew app push
- **Always-on omnichannel presence** — Answers the 2am move-out emergency, the Sunday WhatsApp, and the Spanish-only caller all at once, in parallel, with no hold, no fatigue, no sick days, forever.  
  ↳ *needs:* Multi-channel concurrent handling; EN/PT/ES voice; Conversation Relay scaling
- **Instant review & reputation defense** — Detects a brewing negative experience mid-conversation and resolves it before it becomes a public 1-star, while routing every happy client to leave a 5-star — net reputation improves automatically.  
  ↳ *needs:* Real-time sentiment on transcripts; owner alert; review-gating link logic
- **Price-elasticity discovery** — Quietly learns the exact price each customer segment and zip will accept by measuring book-rate across micro-price tests, finding the revenue-max price no human could compute.  
  ↳ *needs:* Quote-vs-conversion logging by segment; elasticity model feeding pricing engine
- **Instant overflow + competitor-poaching answer** — The moment a caller hangs up on a competitor's voicemail and dials the next listing, Gui has already answered, quoted, and booked — Gui picks up every overflow and after-hours call across thousands of tenants in parallel with zero ring-time, capturing the high-intent leads competitors physically cannot answer fast enough.  
  ↳ *needs:* Twilio massive concurrency + sub-second pickup; multi-tenant routing; cross-tenant no shared queue; lead.js instant capture
- **Continuous full-fleet slot-Tetris re-optimizer** — Every minute of every day, re-solves the entire booking board across all crews, all zips, all days — collapsing drive time, back-filling cancellations, and shifting flexible recurring clients by a day to open a high-value same-day slot, squeezing 1-2 extra paid jobs per crew per day that no human dispatcher could ever continuously recompute.  
  ↳ *needs:* Live calendar + Maps traffic; constraint solver running on CronCreate loop; auto-reschedule with customer-consent SMS; revenue-per-slot objective function
- **Real-time competitor price & availability shadowing** — Continuously monitors competitor pricing, promos, and 'booked-out' availability across the metro and auto-adjusts the owner's quotes and same-day discounts to always be the most attractive answerable option, winning the price-elastic shopper in real time at a scale no owner could track manually.  
  ↳ *needs:* Competitor data scraping/cache; pricing engine with competitive modifier; per-zip market table; WebSearch/scrape pipeline
- **Autonomous lifetime-value maximizer per customer** — For each customer simultaneously, Gui runs an always-on optimization of their entire lifecycle — when to nudge a deep clean, when to upsell, when to convert to recurring, when to send a save offer — choosing the single highest-LTV next action for every customer in the database at once, recomputed daily.  
  ↳ *needs:* Per-customer LTV model + next-best-action engine; full history + payment data; outbound funnel orchestration; daily CronCreate batch
- **Mass review-velocity engine across whole base** — Across the entire happy-customer base, Gui orchestrates a continuous, throttled stream of review requests timed to each customer's satisfaction peak and platform (Google/Yelp/Facebook), engineering a steady climb in star rating and review count that floods local SEO — impossible for an owner to run consistently across hundreds of clients.  
  ↳ *needs:* Per-customer satisfaction + platform targeting; Google Business Profile API; throttled review-link scheduler; attribution + ranking-impact tracking
- **Predictive weather & local-event demand pre-booking** — Sees a storm, pollen spike, big-game weekend, or graduation coming and pre-emptively reaches the right segments ('post-storm window wash', 'post-party deep clean') to pre-sell capacity before demand exists, filling the calendar ahead of competitors who only react.  
  ↳ *needs:* Weather + local-events API; segment-to-trigger mapping; outbound funnel; capacity-aware offer throttle

## 💰 Killer revenue moves
- Reactivation blitz on the dead list: mass-call/text every lapsed and one-time client in a single afternoon — for most cleaning companies the database of past customers is the single largest untapped asset, and turning it into booked jobs in a day is the biggest one-shot cash injection Gui delivers
- Zero missed-call capture + instant overflow poaching: every after-hours, overflow, and competitor-rollover call becomes a booked, prepaid clean. Cleaning leads are high-intent and price-insensitive when answered in seconds, and ~60%+ of small-cleaner calls go to voicemail today — Gui converts the leak directly into revenue
- Recurring-plan conversion at the point of first booking: turning a one-time clean into a weekly/biweekly subscription multiplies lifetime value 10-50x and stabilizes cash flow — Gui makes the recurring offer on every single first booking, at a conversion rate no tired human closer matches
- Property-manager / Airbnb / realtor portfolio land-and-expand: capturing a single property manager or short-term-rental host converts one call into dozens of standing turnover cleans per month with consolidated billing — the highest-revenue-per-acquisition move in the vertical
- Deposit-at-booking + automatic late/lockout/no-show fee capture: eliminates no-show losses and recovers trip fees owners normally eat entirely — pure margin recovered on every risky job, charged automatically to the card on file
- Waitlist auto-fill + continuous slot-Tetris re-optimization: freed slots never go empty and each crew is squeezed for 1-2 extra paid jobs per day by collapsing drive time — pure recovered revenue from otherwise-idle crew hours, recomputed every minute
- Smart upsells (deep clean, fridge/oven/windows, baseboards, add-ons) on every booking: lifts average ticket 20-40% with zero added marketing spend, applied with perfect consistency on 100% of bookings

## 🔌 Integrations to connect
- Twilio (Voice, Programmable Messaging/SMS, WhatsApp Business API, Twilio Pay, Conversation Relay) for omnichannel + PCI voice card capture
- Stripe (Payment Links, subscriptions for recurring plans, saved cards for fees, refunds, consolidated invoicing for portfolio accounts)
- Housecall Pro / Jobber / ZenMaid / Launch27 (cleaning-specific FSM for jobs, crews, recurring schedules, invoices)
- Google Calendar + Google Maps Distance Matrix/Routes API (with live traffic) for crew availability and continuous route-aware scheduling
- Google Business Profile API + Yelp/Facebook for one-tap review requests, reputation monitoring, and review-velocity orchestration
- Supabase (multi-tenant DB: pricing rules, coverage zips, service catalog, customer memory, transcripts, call_logs, LTV/churn features)
- QuickBooks / Xero for invoicing and bookkeeping sync
- Property data API (county assessor / Zillow / Melissa) for instant sqft-based quoting from an address
- Vision model for photo-based deep-clean estimation via MMS/WhatsApp images
- Airbnb / VRBO / property-management-system iCal + webhooks for automatic turnover-clean triggering on guest checkout
- Weather + local-events API for predictive demand pre-booking
- Competitor pricing/availability data feed (scrape/cache) for real-time competitive quote adjustment

## 📝 Collect at signup (onboarding)
- Service menu & price grid: per-service base rates, sqft/per-room/per-bathroom modifiers, deep/move-out/recurring multipliers, add-on prices (fridge, oven, windows, baseboards, laundry)
- Coverage area: exact zip codes served, plus any trip-fee zones or hard no-go areas
- Crew roster & capacity: number of crews, working hours/days, jobs-per-day capacity, and which zips/services each crew covers
- Calendar & FSM connection: link to Housecall Pro/Jobber/Google Calendar so Gui books into the real system day one
- Stripe account + payment policy: deposit %, cancellation notice window and fee, lockout/trip fee, recurring discount tiers
- Business trust facts: insured/bonded status & COI details, do-we-bring-supplies, eco/pet-safe products, key/lockbox policy, do-customers-need-to-be-home
- Arrival-window & reminder preferences: window size (e.g. 2h), how far ahead to send confirmations/reminders, prep-checklist text
- Languages & greeting: which of EN/PT/ES to use, company name, and the exact greeting/persona tone
- Customer list import: existing and lapsed clients with phone, address, last service, frequency — to power reactivation, memory, and LTV scoring on day one
- Escalation rules: owner phone/WhatsApp for complaints, commercial bids, and emergencies, plus which job types to never quote and refer out
- Commercial & portfolio accounts: existing property-manager / Airbnb / realtor relationships, per-account bulk pricing, consolidated-billing preferences, and PMS/iCal links for automatic turnover triggering
- Review & reputation targets: Google/Yelp/Facebook profile links, current rating, and how aggressively to request reviews — so Gui can run the review-velocity engine within the owner's comfort
