# 🏠 Real Estate — Gui Agent Playbook

> Gui becomes the brokerage's omniscient, never-sleeping growth engine — ISA + transaction coordinator + listing analyst + database whisperer fused into one. Every Zillow/sign-call ping answered in 8 seconds at 2am, every lead qualified and budget-mapped to live inventory, every showing booked, every dormant lead resurrected, every likely-to-list homeowner reached before a competitor knows they exist — so no commission ever dies in a voicemail, and no future seller ever lists with someone else.

## 🟢 Core (table-stakes)
- **Instant lead capture (speed-to-lead)** — Answers every inbound call, text, WhatsApp and web-form lead in seconds, 24/7, in EN/PT/ES — the single biggest driver of conversion in real estate where 78% of buyers go with the first agent who responds.  
  ↳ *needs:* Twilio Voice + Messaging inbound webhook; Zillow/Realtor.com/portal lead webhooks; website form POST → /api/lead; sub-60-second dial-back via call.js dial gate
- **Buyer/seller lead qualification (BANT)** — Asks budget, timeline, pre-approval/financing status, must-haves (beds/baths/area/school zone), buy-vs-sell, and current address; scores and routes hot leads to the right agent instantly.  
  ↳ *needs:* Scripted qualification flow + lead scoring table in Supabase; agent routing rules; gui_actions insert; round-robin/territory map from collectAtSignup
- **Showing & open-house booking** — Books property showings and tour slots directly into the listing agent's calendar, holds time, confirms address and access notes, and prevents double-booking across the team.  
  ↳ *needs:* Google Calendar / Outlook via /api/agent-schedule scheduling engine (biz_* tables); ShowingTime or BrokerBay integration; per-agent calendar OAuth
- **Listing & property Q&A** — Answers price, square footage, beds/baths, HOA fees, taxes, lot size, days-on-market, school district and status (active/pending) for any listing by pulling live MLS/IDX data.  
  ↳ *needs:* MLS/IDX feed (RESO Web API or Spark/Bridge Interactive); listing data synced to Supabase; address/MLS# lookup
- **Lead routing & live transfer** — Warm-transfers a qualified, ready-now buyer to the available on-call agent, or assigns by territory/price-band/language and notifies the agent by SMS+push with full context.  
  ↳ *needs:* Twilio warm transfer/conference; agent on-call roster; PushNotification; territory rules from signup
- **Automated follow-up sequences** — Runs multi-touch nurture (call+text+email) over days/weeks for leads not ready now — the follow-up that agents notoriously drop after 1-2 attempts.  
  ↳ *needs:* CronCreate scheduled cadences; emailTemplates.js branded email; lead.js noCall honor; SMS via Twilio
- **Pre-approval & financing triage** — Captures financing status, connects unapproved buyers to the brokerage's preferred lender, and flags cash buyers as priority.  
  ↳ *needs:* Preferred lender contact/handoff; lender referral webhook or warm transfer; lead field financingStatus
- **Seller valuation (CMA) requests** — Captures 'what's my home worth' callers, gathers address + property details, triggers a CMA, and books a listing appointment — the highest-value lead type.  
  ↳ *needs:* AVM/CMA data source (e.g., HouseCanary, ATTOM, or MLS comps); listing-appointment calendar; seller lead table
- **Rental & property-management intake** — Handles rental inquiries, screens applicants (income/credit/move-in date), schedules unit tours, and logs maintenance requests for managed properties.  
  ↳ *needs:* Rental listing feed; applicant screening partner (TransUnion SmartMove/Findigs); maintenance ticket table; PM software integration
- **After-hours & overflow coverage** — Covers nights, weekends and call overflow when agents are in showings or closings, so no lead hits voicemail — ever.  
  ↳ *needs:* 24/7 Twilio routing; voicemail-replacement flow; missed-call auto-text-back

## 🔵 Advanced (proactive automations)
- **New-listing instant alert blast** — The moment a listing goes active or has a price drop, Gui texts/calls every buyer in the database whose saved criteria match that property, with a one-tap 'book a tour' link.  
  ↳ *needs:* MLS new-listing/price-change webhook; buyer saved-search criteria table; matching engine; Twilio SMS + booking link
- **Pre-approval expiration & rate-watch nudges** — Tracks each buyer's pre-approval date and current mortgage rates; proactively nudges buyers when their approval is about to expire or when rates drop enough to expand their budget.  
  ↳ *needs:* Pre-approval date field; mortgage rate API (e.g., Freddie Mac PMMS / Optimal Blue); CronCreate; lender handoff
- **Open-house follow-up within the hour** — Scans the open-house sign-in sheet and auto-calls/texts every visitor within 60 minutes with a thank-you, the listing details, and a 'want a private showing?' offer.  
  ↳ *needs:* Digital open-house sign-in (Spacio/Curb Hero) webhook; visitor list import; immediate cadence trigger
- **Closing & milestone concierge** — Walks buyers/sellers through transaction milestones (inspection, appraisal, financing contingency, walkthrough, closing day) with reminders and document nudges so deals don't stall.  
  ↳ *needs:* Transaction coordinator data (Dotloop/SkySlope/Folio); milestone calendar; emailTemplates.js + SMS reminders
- **Past-client anniversary & equity check-ins** — Remembers every past client's purchase date and reaches out on the home-buying anniversary and annually with an updated home value + 'thinking of selling?' touch — the #1 repeat/referral driver.  
  ↳ *needs:* Closed-deal CRM history; purchase date + address; AVM for current value; CronCreate annual cadence; branded email
- **Stale-listing seller re-engagement** — For listings sitting past average DOM, Gui proactively calls the seller with market feedback, showing stats, and a price-adjustment conversation framed gently.  
  ↳ *needs:* DOM + showing-activity data from MLS/ShowingTime; seller contact; scripted price-reduction conversation
- **Referral & review harvesting** — After a successful closing, Gui asks for a Google/Zillow review and a referral via call+text at the emotional peak, then routes any referral straight into the lead pipeline.  
  ↳ *needs:* Closing event trigger; Google Business / Zillow review links; referral capture → lead table
- **Buyer drip with curated listings** — Sends each active buyer a weekly personalized text/email of 3-5 new matches from MLS, learning from which ones they click to refine taste.  
  ↳ *needs:* Saved-search + click-tracking; MLS feed; weekly Cron; per-buyer personalization model
- **Lockbox/access & showing-feedback loop** — After every showing, auto-collects buyer-agent feedback for the listing agent and relays summarized seller-ready feedback to the homeowner.  
  ↳ *needs:* ShowingTime/BrokerBay feedback webhook; summarization; seller SMS/email relay
- **FSBO & expired-listing outreach** — Calls For-Sale-By-Owner and expired listings from a sourced list with a compliant, personalized listing-pitch script and books listing appointments.  
  ↳ *needs:* FSBO/expired data source (RedX/Vulcan7/Espresso Agent); DNC scrub via call.js gate; listing-appt calendar
- **Live affordability & payment math on the call** — While a buyer is still on the phone, Gui computes monthly PITI for any listing at current rates given their down payment, instantly tells them what they can afford, and reframes 'too expensive' objections in real time.  
  ↳ *needs:* Mortgage rate API + property tax/HOA/insurance data (ATTOM); amortization calc; per-lead down-payment field
- **Buyer-agreement & disclosure e-sign capture** — Post-NAR-settlement, Gui explains and sends the buyer-representation agreement and required disclosures, captures e-signature before the first showing, and logs compliance — closing the legal gap that now blocks tours.  
  ↳ *needs:* DocuSign/Dotloop e-sign API; brokerage buyer-agreement template; compliance audit log in Supabase

## 🟣 Superhuman (impossible for a human)
- **500-lead database reactivation overnight** — Calls and texts the entire dormant lead/past-client database (thousands) simultaneously in one night, re-qualifies who's now ready to move, and hands warm replies to agents by morning — work that would take an ISA team months.  
  ↳ *needs:* Concurrent Twilio call/SMS fan-out; call.js caps+DNC; lead DB; reply triage → agent queue
- **Millisecond omniscient listing recall** — Cross-references every active MLS listing, price history, comp, HOA, tax record, school rating and inventory level instantly to answer any buyer question more accurately than any agent could from memory.  
  ↳ *needs:* Full MLS/IDX + ATTOM/county records + GreatSchools data in Supabase; vector + structured lookup
- **Predictive seller / 'likely-to-list' scoring** — Scores every contact and neighborhood for likelihood to sell in the next 6-12 months using equity, tenure, life-event and market signals, then prioritizes Gui's outreach to future sellers before they call any competitor.  
  ↳ *needs:* Property tenure/equity data (ATTOM/HouseCanary); propensity model; Cron-driven prioritized outreach
- **No-show & deal-fall-through prediction** — Predicts which showings will no-show and which deals are at risk of collapsing (financing, cold feet) from behavioral signals, and intervenes early with reminders or a reassurance call.  
  ↳ *needs:* Historical showing/closing outcomes; engagement signals; predictive model; intervention cadence
- **Self-optimizing script A/B testing** — Runs live A/B/n tests on its own greeting, qualification questions, and follow-up timing across thousands of contacts, auto-promoting the variant with the highest booking/answer rate per segment.  
  ↳ *needs:* Variant engine + per-call outcome logging; gui_actions analytics; auto-rollout of winning script
- **Mass 1:1 hyper-personalized outreach** — Sends thousands of individually unique messages — each referencing that contact's saved criteria, last viewed home, neighborhood and timeline — at a personalization depth no human team could sustain.  
  ↳ *needs:* Per-contact profile + interaction history; LLM message generation; Twilio/email at scale; emailTemplates.js
- **Perfect eternal memory of every contact** — Remembers every conversation, preference, kid's name, ideal block and objection from years ago, so any future call feels like talking to an agent who never forgot a detail.  
  ↳ *needs:* Persistent per-contact transcript+memory store (call_logs + profile); retrieval on every interaction
- **Real-time market-shift mass alerting** — Detects a rate drop, inventory surge or hot new neighborhood and within minutes alerts exactly the segment of buyers/sellers it benefits, each with a tailored reason to act now.  
  ↳ *needs:* Rate + MLS inventory monitors; segment matcher; instant SMS/call fan-out
- **Always-on multilingual concierge at infinite scale** — Handles unlimited simultaneous calls and chats in EN/PT/ES with zero hold time, so 50 Zillow leads arriving at once are all engaged personally in the same minute — impossible for any staffed desk.  
  ↳ *needs:* Concurrent Twilio sessions; multilingual voice (ElevenLabs/Deepgram); language detection; no queue
- **Cross-portfolio inventory matchmaking** — Instantly matches a new seller's home to every active buyer across the whole brokerage's database and vice-versa, surfacing off-market double-end commission opportunities humans never connect.  
  ↳ *needs:* Brokerage-wide buyer + listing DB; matching engine; agent-to-agent internal notification
- **County-wide pre-listing radar (first-knock advantage)** — Continuously ingests public records — new probate filings, divorce records, tax-delinquency notices, expired/withdrawn listings, building permits, NOD/pre-foreclosure, and absentee-owner changes — across every county the brokerage covers, and within minutes of a signal appearing dials/texts that homeowner with a tailored listing pitch before any competitor has even seen the record. No human can monitor every courthouse and assessor feed 24/7.  
  ↳ *needs:* County recorder + court + tax-lien + permit data feeds (ATTOM/PropStream/DataTree); pre-foreclosure (Auction.com/RealtyTrac); event-trigger → DNC-scrubbed call.js outreach; per-county coverage map from signup
- **Sub-second portal-lead interception across all sources at once** — The instant a lead form fires on Zillow, Realtor.com, Redfin, Homes.com, Facebook and the brokerage site — even ten at the exact same second — Gui engages every single one by call AND text within 1-2 seconds in parallel, while a human ISA can physically dial only one at a time and loses the rest. Wins the speed-to-lead race on 100% of inbounds simultaneously.  
  ↳ *needs:* All-portal webhook fan-in; parallel Twilio call+SMS dispatch with no serialization; call.js concurrency caps; dedupe across sources
- **Self-priced live CMA narration on first contact** — While a 'what's my home worth' seller is still on the line, Gui pulls live comps, active/pending/sold within the radius, current DOM and absorption rate, computes a defensible value range, and narrates a full mini-CMA conversationally on the spot — then books the listing appointment before they hang up. No agent can produce a comped valuation mid-call from memory.  
  ↳ *needs:* Real-time comps + sold data (MLS/RESO) + AVM (HouseCanary/ATTOM); on-the-fly valuation engine; listing-appointment calendar; seller lead table
- **Continuous 24/7 portfolio equity & refi-cash watch** — Recomputes the current value, equity position and refi/HELOC opportunity for every past client and tracked homeowner every single day against live AVM + rate data, and the moment a household crosses a 'sell-makes-sense' or 'move-up-affordable' threshold, proactively reaches out with the exact numbers. Humans review a sphere maybe once a year; Gui does it nightly for the entire database.  
  ↳ *needs:* Nightly Cron over full contact DB; per-property AVM refresh (ATTOM/HouseCanary); rate API; equity-threshold rules; branded outreach
- **Real-time multi-channel sentiment + buying-temperature scoring** — Reads tone, hesitation, urgency words and reply latency across every call, text and email simultaneously for the entire pipeline, recomputes each lead's live 'temperature' on every interaction, and instantly re-prioritizes the agent's call queue — surfacing the lead about to buy before any human notices the signal.  
  ↳ *needs:* Per-call sentiment from call transcripts (call_logs mirror); cross-channel signal fusion; live lead-temperature scoring table; agent queue re-rank + push
- **Instant fair-housing & compliance guardrail on every message** — Screens 100% of its own outbound calls, texts and emails in real time against fair-housing, TCPA, DNC and state advertising rules before they send — flagging steering language, protected-class references and consent gaps across thousands of messages a day with zero lapses, where a human team inevitably slips.  
  ↳ *needs:* Compliance rule engine + LLM content classifier on every outbound; DNC/consent ledger; call.js gate; audit log in gui_actions

## 💰 Killer revenue moves
- Pre-listing radar + self-priced live CMA: Gui monitors every county's probate, divorce, tax-lien, pre-foreclosure, expired and absentee-owner records and is the FIRST to dial the homeowner, then comps and narrates a valuation on the spot to book the listing appointment. Listing-side commissions are the largest, most defensible revenue ($15k-$50k+ each) and winning them before competitors even see the signal is the single highest-dollar move in the business.
- Sub-second interception of 100% of portal inbounds in parallel (Zillow/Realtor.com/Redfin/Homes.com/FB/site) — converting the 50%+ of paid leads competitors lose to voicemail because a human can only dial one at a time. At a $20-$80 cost-per-lead already spent, every saved lead is a 2.5-3% commission ($7k-$30k+) recovered from money the brokerage already paid for.
- Overnight reactivation of the entire dead-lead + past-client database (call/text thousands at once) plus nightly equity/refi-cash watch that proactively re-engages every homeowner the moment selling or moving up pencils out — resurrecting deals already paid for in marketing spend. Repeat-and-referral business closes at 3-5x cold-lead rates at near-zero acquisition cost; this is the durable, compounding revenue engine.
- Predictive 'likely-to-list' scoring that points Gui's outreach at future sellers 6-12 months before they call anyone, capturing listings at the top of the funnel where a single won listing-side deal returns 100x the agent's monthly Gui cost — and denies that inventory to every competing brokerage in the market.

## 🔌 Integrations to connect
- MLS / IDX feed via RESO Web API, Bridge Interactive, Spark API, or Trestle (live listings, price history, status, DOM, sold comps, absorption)
- Twilio (Voice, Programmable Messaging, WhatsApp Business API) for omnichannel calls/SMS/WhatsApp at concurrency
- Real estate CRMs — Follow Up Boss, kvCORE/BoldTrail, Sierra Interactive, LionDesk, HubSpot (two-way lead sync, pipeline stages)
- Showing & open-house tools — ShowingTime, BrokerBay, Spacio / Curb Hero (digital sign-in), CalendarHook
- Google Calendar / Microsoft Outlook for per-agent showing & listing-appointment scheduling
- Lead portals — Zillow Premier Agent, Realtor.com, Redfin, Homes.com, Facebook Lead Ads webhooks
- Stripe for application fees, earnest-money facilitation links, and PM rent/deposit collection
- Transaction & e-sign — Dotloop, SkySlope, Folio, DocuSign for milestone tracking + buyer-agreement/disclosure e-sign
- Property/valuation & off-market data — ATTOM Data, HouseCanary, CoreLogic, PropStream, DataTree, GreatSchools for comps, equity, taxes, school ratings, county records
- Pre-listing signal feeds — probate/divorce/tax-lien/permit records (ATTOM/PropStream/DataTree), pre-foreclosure/NOD (Auction.com/RealtyTrac), FSBO/expired (RedX/Vulcan7), plus DNC scrub registry
- Mortgage rate + financing feeds — Freddie Mac PMMS / Optimal Blue (live rates), preferred-lender referral webhook for real-time affordability math and refi watch

## 📝 Collect at signup (onboarding)
- Brokerage/team roster: each agent's name, languages, cell, email, calendar OAuth, territory/zip coverage, price-band focus, and on-call hours for correct routing
- MLS access credentials + IDX feed (RESO/Bridge/Spark) and the office's MLS board, so Gui can pull live listing AND sold-comp data day one
- Lead source connections: Zillow/Realtor.com/Redfin/Homes.com/Facebook Premier Agent logins or webhook keys + existing CRM (Follow Up Boss/kvCORE) API key for two-way sync
- Lead-routing rules: round-robin vs. territory vs. price-band, buyer vs. seller vs. rental handling, and which agent/lender gets warm transfers
- Qualification & scripting preferences: required questions (budget, timeline, pre-approval), brokerage compliance language, fair-housing guardrails, buyer-agreement/disclosure templates, and preferred lender/title contacts for handoffs
- Existing database export (past clients + dormant leads with purchase dates, addresses, saved criteria) + DNC/opt-out + consent ledger to power reactivation, anniversary, and equity-watch campaigns compliantly
- Service area + every county to monitor for pre-listing signals, office hours, listing-appointment & showing default durations/buffers, business numbers to port/forward, and Stripe account for fees/deposits
- Data-provider keys/authorizations for off-market and valuation feeds (ATTOM/HouseCanary/PropStream) and any pre-foreclosure/FSBO/expired sources the brokerage already licenses
