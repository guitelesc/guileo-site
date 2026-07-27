# 💇 Salons & Spas — Gui Agent Playbook

> Gui becomes the salon's never-closed front desk, master booker, and revenue brain — filling every empty chair, remembering every client's exact color formula, pricing every slot for maximum yield, and resurrecting dormant clients by the hundreds while the owner sleeps.

## 🟢 Core (table-stakes)
- **24/7 Multichannel Booking** — Answers every call, SMS, and WhatsApp instantly to book, reschedule, or cancel appointments — matching service to the right stylist/therapist and the correct time block (e.g. balayage = 3h, men's cut = 30min).  
  ↳ *needs:* Telephony/SMS/WhatsApp inbound (Twilio Voice + Messaging), booking engine bridge /api/agent-schedule writing to biz_* tables in Supabase, service-duration catalog per provider
- **Service & Price Quoting** — Quotes exact prices for every service (cut, color, gel, lash lift, deep-tissue 60/90min, facials), explains add-ons, and warns when a consult is required (e.g. color correction, keratin on virgin hair).  
  ↳ *needs:* Per-tenant service+price+duration table, add-on rules, consult-required flags; gui_actions read path
- **Stylist/Provider Selection & Matching** — Lets clients request a specific stylist or auto-assigns by service skill, level (junior/senior/master pricing), and live availability; honors 'I only see Maria' loyalty.  
  ↳ *needs:* Provider roster with skills + price tier + working hours, client-to-preferred-provider mapping in client profile table
- **Smart Calendar Hold & Confirm** — Holds the slot during the conversation, books it, blocks correct duration + buffer/cleanup time, and sends instant SMS/WhatsApp confirmation with location pin and prep notes.  
  ↳ *needs:* Scheduling engine hold/commit (/api/agent-schedule), Google Calendar / Vagaro / Booksy two-way sync, buffer rules per service, emailTemplates.js confirmation render
- **Reminders & Confirmation Cascade** — Sends 48h + 2h reminders, asks client to confirm with one tap, and auto-prompts prep ('arrive with clean dry hair', 'no caffeine before massage').  
  ↳ *needs:* Scheduled task cron, two-way SMS confirm capture writing back to appointment status, service-specific prep template library
- **Cancellation, Reschedule & Deposit Policy Enforcement** — Handles cancels/reschedules, enforces the salon's window (e.g. 24h), charges or forfeits deposit on late cancels/no-shows per policy — without an awkward human conversation.  
  ↳ *needs:* Policy config per tenant, Stripe deposit capture/refund API, card-on-file token, appointment state machine with idempotent charge
- **Deposit & Payment Collection** — Takes deposits or full prepay via Stripe SMS link or card-by-voice for high-demand services and new clients; charges no-show fees automatically.  
  ↳ *needs:* Stripe Payment Links + PCI card-by-voice (Twilio Pay), saved card tokenization, deposit amount rules per service
- **FAQ & Hours / Location / Policy Answers** — Answers parking, walk-in policy, hours, what to bring, patch-test requirements, age policy, gift card balance, and product questions in EN/PT/ES instantly.  
  ↳ *needs:* Tenant knowledge base (hours, location, policies, FAQ), gift-card balance lookup, multilingual NLU
- **Waitlist & Cancellation Backfill** — Adds clients to a waitlist for full days/popular stylists and instantly offers freed slots when a cancellation opens, first-come via SMS.  
  ↳ *needs:* Waitlist table, cancellation trigger → ranked outbound offer queue, time-boxed claim link, call.js dial gate
- **Gift Card & Package/Membership Sales** — Sells gift cards, prepaid packages (5-massage bundle), and memberships over the phone/text, takes payment, and emails the certificate.  
  ↳ *needs:* Stripe checkout, gift-card/package ledger table, membership entitlement tracking, branded gift-card email template
- **Intake & Consultation Capture** — Collects new-client intake before arrival: allergies, color history, skin conditions, contraindications (pregnancy for certain massages/facials), preferred pressure — so the chair time is productive.  
  ↳ *needs:* Digital intake form link via SMS, contraindication ruleset, client health/preference profile fields, consent storage

## 🔵 Advanced (proactive automations)
- **Automatic Rebooking at Checkout Cadence** — Knows each service's ideal re-visit interval (root touch-up 4-6wk, lash fill 2-3wk, brow 3wk) and proactively texts the client to rebook exactly when they're due, pre-filling their usual stylist and slot.  
  ↳ *needs:* Per-service rebook interval model, last-visit history, outbound SMS/WhatsApp with one-tap rebook deep link to scheduler
- **No-Show Risk Scoring & Pre-emptive Action** — Flags high-risk bookings (new client, Friday peak, history of late cancels) and requires a deposit or extra confirmation only for those, protecting prime slots.  
  ↳ *needs:* No-show probability model on client history + slot features, conditional deposit logic, Stripe pre-auth
- **Gap & Idle-Chair Filler** — Watches the live calendar for holes (a 1pm cancel leaving Maria idle 1-2pm) and instantly markets that exact gap to nearby lapsed or waitlisted clients with a same-day incentive.  
  ↳ *needs:* Real-time calendar gap detection, geo/recency-ranked client segment, dynamic same-day offer engine, outbound dial/SMS via call.js
- **Loyalty, Birthday & Win-Back Touches** — Sends birthday-month offers, milestone perks ('your 10th visit blow-dry is on us'), and personalized win-back texts referencing the client's last service and stylist.  
  ↳ *needs:* Visit-count + birthday fields, loyalty rule engine, personalized message templates with service/stylist merge fields
- **Upsell & Add-On Suggestion at Booking** — Suggests relevant add-ons in context — 'add a gloss to make that color last', 'pair the facial with a 30-min scalp massage' — lifting average ticket without pressure.  
  ↳ *needs:* Service affinity/upsell map, current-cart context in booking flow, margin-aware ranking
- **Retail & Product Reorder Nudges** — Tracks which retail products a client bought (the shampoo, the serum) and texts a reorder link right when they'd be running low, with pickup or ship option.  
  ↳ *needs:* POS retail purchase history, product depletion-interval model, Stripe checkout + fulfillment flag
- **Review Generation & Reputation Routing** — After a visit, texts happy clients a Google/Yelp review link and routes unhappy ones privately to the owner before they post publicly.  
  ↳ *needs:* Post-visit sentiment ask, Google/Yelp review deep links, negative-feedback escalation to owner, call_logs sentiment mirror
- **Stylist Schedule Optimization Alerts** — Tells the owner each morning which stylists are underbooked and proactively launches targeted fill campaigns, and flags over-booked providers to protect service quality.  
  ↳ *needs:* Per-provider utilization calc, morning digest, link to gap-filler campaign engine
- **Group & Event Booking Coordination** — Handles bridal parties, birthday glam, and spa-day groups — coordinating multiple providers and times in one conversation, collecting a group deposit.  
  ↳ *needs:* Multi-appointment transaction in scheduler, provider co-availability solver, single group Stripe deposit, group prep template
- **Seasonal & Capacity-Aware Promotions** — Auto-fills predictably slow windows (January, mid-week mornings) and caps discounts during prom/wedding/holiday peaks when demand is already high.  
  ↳ *needs:* Historical demand seasonality model, dynamic promo rules, mid-week/peak calendar tagging
- **Multilingual Concierge Continuity** — Detects the client's language across channels and keeps every future interaction in EN/PT/ES, including all reminders and offers — no language ever gets lost.  
  ↳ *needs:* Language preference stored on profile, multilingual template set, channel-agnostic identity stitching

## 🟣 Superhuman (impossible for a human)
- **Mass Lapsed-Client Resurrection** — Calls and texts all 500+ clients who haven't returned in 90+ days simultaneously in one evening, each message personalized to their last service, stylist, and a tailored come-back offer — something no front desk could ever do.  
  ↳ *needs:* Full client history DB, segmentation query, parallel outbound via call.js dial gate (DNC+caps), per-client merge personalization, Stripe offer links
- **Instant Omniscient Recall** — In milliseconds recalls every client's exact color formula, developer volume, last 12 visits, allergies, preferred pressure, products bought, and tip history — so even a brand-new stylist delivers like a 10-year regular's stylist.  
  ↳ *needs:* Unified client profile with formula/notes fields, full visit + retail + note history, sub-second retrieval surfaced to Gui and portal
- **Predictive No-Show & Demand Forecasting** — Predicts tomorrow's no-shows before they happen and overbooks intelligently, and forecasts next month's demand by service so the owner staffs and orders product perfectly.  
  ↳ *needs:* Trained no-show + demand models on historical bookings/weather/seasonality, overbooking policy engine, staffing/inventory forecast report
- **Always-Awake 3am Capture** — Books the 2am scroll-and-book impulse client and the during-your-other-appointment caller every single time — capturing the ~30-40% of bookings that happen outside business hours and would otherwise hit voicemail and vanish.  
  ↳ *needs:* 24/7 voice+messaging always-on, instant scheduler write, no human dependency
- **Real-Time Self-A/B-Testing Scripts** — Continuously A/B tests its own greetings, offer wording, deposit asks, and rebook timing across thousands of conversations, auto-adopting whatever books more and forfeits less — improving conversion every week with zero owner effort.  
  ↳ *needs:* Variant framework on scripts/offers, outcome attribution (booked/paid/showed), auto-promotion of winning variants, per-tenant experiment log
- **Simultaneous Infinite Concurrency** — Handles a Monday-morning flood of 50 calls and 200 texts at once, each with full attention and zero hold time, on the busiest prom/holiday day — impossible for any sized front desk.  
  ↳ *needs:* Concurrent session handling, per-tenant rate isolation, stateless conversation orchestration
- **Cross-Channel Perfect Memory Forever** — Remembers a client who called in Portuguese 14 months ago, texted in English last week, and DMs on WhatsApp today as ONE person with one continuous history — never asks them to repeat anything, ever.  
  ↳ *needs:* Identity resolution across phone/SMS/WhatsApp, permanent unified timeline, channel-agnostic profile key
- **Live Dynamic Yield Pricing & Slot Optimization** — Continuously reprices and reshuffles offers in real time — nudging flexible clients off prime Saturday slots into idle Tuesday gaps with micro-incentives — to maximize revenue per chair across the whole week automatically.  
  ↳ *needs:* Live calendar state, per-slot yield value model, client price-flexibility scoring, automated micro-offer dispatch
- **Instant Contraindication & Safety Cross-Check** — Cross-references every booking against the client's stored allergies, pregnancy status, medications, and prior reactions in milliseconds and blocks or flags unsafe services (chemical service over compromised hair, hot-stone in pregnancy) before they're ever booked.  
  ↳ *needs:* Health/contraindication profile, service-risk ruleset, real-time pre-book validation gate
- **Owner-Sleep Revenue Dashboard & Autopilot** — While the owner sleeps, Gui fills tomorrow's gaps, collects deposits, resurrects lapsed clients, and answers everyone — then hands over a morning brief of revenue booked overnight and chairs still to fill.  
  ↳ *needs:* Overnight autonomous campaign execution, portal dashboard, morning digest via branded email, call_logs/appointment mirror
- **Per-Client Churn-Risk Radar & Auto-Intervention** — Continuously scores every active client's probability of silently lapsing — detecting the lengthening gap, the skipped rebook, the unanswered reminder — and fires a personalized retention touch (with the right stylist, right offer, right channel) days BEFORE a human would ever notice they were drifting away.  
  ↳ *needs:* Per-client churn-propensity model on visit-gap trend + engagement signals, automated graduated-intervention ladder, outbound SMS/WhatsApp/call dispatch, retention attribution log
- **Whole-Book Revenue-Maximizing Schedule Solver** — Solves the entire week's calendar as one optimization — packing services to eliminate dead gaps, sequencing each stylist's day for zero idle minutes, steering long high-margin services into the windows that yield most, and back-to-backing compatible appointments — a combinatorial problem no human can compute across 8 stylists and 300 slots.  
  ↳ *needs:* Constraint solver over provider hours/skills/durations/buffers, per-service margin + yield weights, live booking state, automated reschedule-offer dispatch to move clients with consent
- **1:1 Generative Outreach at Full-Book Scale** — Writes a genuinely unique, on-brand message to every single client — referencing their actual last formula, the compliment they gave Maria, their kid's name they mentioned, their seasonal pattern — and sends thousands of these truly individual notes at once, indistinguishable from a stylist who knows them personally.  
  ↳ *needs:* LLM generation grounded on full per-client profile + interaction notes, brand-voice guardrails, bulk personalized dispatch via call.js/Messaging, opt-out + frequency caps
- **Real-Time Competitor & Market Price Sensing** — Monitors local competitor pricing, promos, and review sentiment continuously, and auto-tunes the salon's own offers, deposit asks, and slow-window discounts to stay perfectly positioned — pricing intelligence that would take a full-time analyst the owner will never hire.  
  ↳ *needs:* Competitor/market data feed (public listings + review sources), local-market price index, dynamic offer-tuning rules tied to promo engine, owner guardrails on floor/ceiling pricing
- **Predictive Inventory & Color-Bar Auto-Replenish** — Forecasts exact product depletion from the actual booked service mix — knowing 14 balayages next week burns X of developer and Y tubes of a shade — and auto-builds the reorder before the color bar ever runs dry mid-service, preventing the silent revenue loss of turning clients away.  
  ↳ *needs:* Booked-service → product-consumption model, current stock ledger, supplier reorder thresholds + auto-PO draft, owner approve-to-send flow
- **Lifetime-Value-Aware Decisioning on Every Interaction** — Knows each client's full lifetime value and trajectory in real time and silently adjusts how it treats them — comping a late fee for a $9k/yr VIP, holding a prime slot for a high-LTV regular, prioritizing the right caller — making the economically optimal call on every single interaction at once, across the whole book.  
  ↳ *needs:* Per-client LTV + margin model, real-time decision policy layer wired into booking/fee/waitlist logic, owner-set VIP thresholds, decision audit log

## 💰 Killer revenue moves
- Idle-chair gap filler + whole-book schedule solver: every cancellation, hole, and dead gap across all stylists is instantly remarketed and the week is repacked for zero idle minutes — directly converting the single biggest dollar leak in salons (empty chair time at fixed labor cost) into booked revenue, all week, automatically.
- Mass lapsed-client resurrection + churn-risk radar: one overnight personalized call+text campaign reactivates 500+ dormant clients AND a per-client radar catches drifting regulars days before they're gone — together recovering a huge slice of lost lifetime value that walks out the door silently every month.
- Automatic rebooking cadence at the right interval (4-6wk color, 2-3wk lash fill): lifting every client's annual visit frequency by even one or two visits is near-zero-cost pure recurring revenue and compounds across the entire book — the highest-ROI lever in the building.
- No-show + deposit enforcement with risk scoring: 24h-window deposits and auto no-show fees applied only to high-risk bookings recover thousands per month in otherwise-lost prime slots plus chargeable fees, with zero awkward human conversation.
- After-hours + infinite-concurrency capture: booking the 30-40% of demand that hits outside hours or during a Monday flood — instead of dying in voicemail or a busy signal — is found money that literally never touched the calendar before, captured at zero marginal staffing cost.
- Live dynamic yield pricing + LTV-aware decisioning: repricing slots in real time to fill cheap windows and protect prime ones, while treating each client by their true lifetime value, squeezes maximum revenue per chair-hour out of the exact same calendar — a margin lever no human front desk can run.
- Membership/package + predictive retail reorder selling over voice/text: converts one-off clients into prepaid recurring members and auto-reorders product right at depletion, structurally raising LTV and high-margin retail revenue on autopilot.

## 🔌 Integrations to connect
- Twilio (Voice + Programmable Messaging + WhatsApp Business API + Twilio Pay for card-by-voice)
- Stripe (Payment Links, deposits/pre-auth, no-show fees, gift cards, memberships, saved card tokens)
- Salon booking platforms: Vagaro, Booksy, Boulevard, Fresha, GlossGenius, Mindbody (two-way appointment + client sync)
- Google Calendar / Google Business Profile (calendar sync + review link routing)
- Square / Clover POS (service + retail purchase history, ticket totals, tips, stock ledger)
- Google Reviews + Yelp (review generation deep links, reputation routing, competitor sentiment sensing)
- Supabase (biz_* scheduling tables, unified client profile, call_logs, gui_actions, LTV/churn/yield model tables) + emailTemplates.js for all client email
- Product supplier / distributor ordering portals (color-bar auto-replenish PO drafts) + local market price data feeds
- Mailchimp / Klaviyo or native SMS for campaign list sync (optional)

## 📝 Collect at signup (onboarding)
- Full service menu with per-service price, exact duration, required buffer/cleanup time, profit margin, and consult-required or patch-test flags
- Provider roster: each stylist/therapist's skills, price tier (junior/senior/master), working hours, and which services they perform
- Booking platform + POS in use and credentials/API access (Vagaro/Booksy/Boulevard/Square/etc.) for two-way sync, or opt into Gui's native scheduler
- Policies: cancellation window, deposit amounts/rules, no-show fee, late/walk-in policy, age and contraindication rules, plus VIP/comp thresholds for LTV-aware decisioning
- Business basics: hours, location + parking, languages to support (EN/PT/ES), holidays/closures, gift-card & membership/package offerings and prices
- Re-visit intervals per service (rebooking cadence), seasonal slow/peak periods, and historical booking export for no-show/demand/churn/yield model training
- Stripe account connection + which services require deposits/prepay, product-to-service consumption mapping and supplier reorder thresholds, and brand voice/persona preferences for Gui's tone
