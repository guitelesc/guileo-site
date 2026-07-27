# 🚗 Auto Dealerships — Gui Agent Playbook

> Gui becomes the dealership's tireless BDC + finance concierge + service advisor in one — answering every up, qualifying every credit, scheduling every test drive and service, and resurrecting every dead lead in EN/PT/ES, 24/7 — and the omniscient profit engine that knows every unit's days-on-lot, every owner's equity, and every lead's exact car, and acts on all of it at once.

## 🟢 Core (table-stakes)
- **Inventory lookup by voice/text** — Caller asks 'do you have a 2022 RAV4 under $30k?' and Gui instantly searches live inventory by make/model/year/trim/mileage/price/color and reads back matching VINs with stock numbers and out-the-door ballpark.  
  ↳ *needs:* DMS/inventory feed (vAuto, HomeNet, Dealer.com, CDK/Reynolds inventory API) synced to Supabase inventory table; VIN decode via NHTSA vPIC API
- **Test-drive booking** — Books a specific vehicle + date/time, holds the unit so two ups don't book the same car, confirms by SMS with address and what to bring (license/insurance).  
  ↳ *needs:* Scheduling engine biz_* tables + /api/agent-schedule bridge; vehicle-hold flag on inventory row; SMS via Twilio
- **Lead capture & qualification (BDC)** — Captures name, phone, vehicle of interest, trade, timeline, cash-vs-finance and pushes a structured lead to the CRM with a hot/warm/cold score before a human ever picks up.  
  ↳ *needs:* CRM write API (DealerSocket, VinSolutions, Elead, DealerCenter) + lead.js funnel + gui_actions insert
- **Trade-in valuation intake** — Collects year/make/model/trim/mileage/condition/VIN and returns a provisional KBB/Black Book range, then routes to appraisal booking.  
  ↳ *needs:* KBB ICO / Black Book / vAuto appraisal API; VIN decode; lead enrichment write to CRM
- **Finance pre-qualification** — Asks soft-pull-friendly questions (income band, employment, down payment, target payment) and triggers a soft credit pre-qual link by SMS; never reads SSN aloud.  
  ↳ *needs:* Lender/aggregator API (RouteOne, Dealertrack, 700Credit soft pull) + secure SMS link; PII redaction policy
- **Service appointment scheduling** — Books oil change / recall / repair by service type and estimated duration into the correct service bay/advisor calendar with loaner/shuttle option.  
  ↳ *needs:* Service scheduler (Xtime, myKaarma, Tekion service, CDK Service) API or biz_* calendar; advisor capacity table
- **Hours, directions, department routing** — Answers sales vs service vs parts vs finance hours, gives directions, and warm-transfers or takes a message for the right department/salesperson.  
  ↳ *needs:* Business profile config; Twilio transfer + voicemail-to-text; department/staff directory in onboarding
- **Deposit & service payment** — Takes a refundable hold deposit on a vehicle or a service diagnostic fee via Stripe SMS link or card-by-voice, emails a receipt.  
  ↳ *needs:* Stripe payment links + Twilio Pay (PCI card-by-voice); emailTemplates.js receipt; deposit ledger table
- **Inbound text/WhatsApp threads** — Handles the 'is this still available?' Marketplace/Autotrader text flood, answers per-VIN, and keeps a per-customer thread with full history.  
  ↳ *needs:* Twilio Messaging + WhatsApp Business API; per-customer conversation store keyed to phone; inventory join

## 🔵 Advanced (proactive automations)
- **Unsold-up (be-back) revival** — Auto-detects ups that visited or called but didn't buy and follows up at 1/3/7/14 days with the exact vehicle they looked at plus 2 fresh comparable arrivals.  
  ↳ *needs:* CRM activity feed + inventory match; scheduled-task cron; per-lead state machine
- **Price-drop & new-arrival alerts** — When a watched VIN drops in price or a matching unit lands on the lot, Gui texts the specific shopper who wanted it: 'the Tacoma you asked about just dropped $1,500.'  
  ↳ *needs:* Inventory change-feed webhook; saved-search/interest table per lead; Twilio outbound
- **Service-to-sales conversion** — Spots service customers whose car is high-mileage, off-lease soon, or in negative-equity-flip range and offers an upgrade appraisal while their car is in the bay.  
  ↳ *needs:* Service RO + DMS ownership data + equity calc (payoff vs Black Book); CRM cross-pollination
- **Lease-end & equity mining** — Watches the portfolio for leases maturing in 60–90 days or loans with positive equity and proactively invites them to upgrade with a pre-built payment.  
  ↳ *needs:* DMS/F&I deal history (lease maturity, payoff, rate); payment quote engine; lender residual data
- **Recall & open-campaign outreach** — Cross-references owned VINs against open NHTSA recalls and books the safety fix automatically, capturing warranty/recall service revenue.  
  ↳ *needs:* NHTSA recall API by VIN; owner-base VIN list from DMS; service scheduler
- **Declined-service follow-up** — When a customer declines recommended work (brakes, tires) at the counter, Gui follows up in 2 weeks with the quote and a booking link before they go to a chain shop.  
  ↳ *needs:* Service RO line-item 'declined' flags (Xtime/CDK); quote store; outbound SMS
- **Conquest & data-mine sold list** — Re-engages the dealership's entire sold-customer database on a rolling basis ('how's the Civic? ready for an upgrade?') to manufacture trade-in inventory.  
  ↳ *needs:* DMS sold-customer export; ownership tenure calc; consent/DNC scrub via call.js gate
- **Multi-vehicle deal assembly** — For a shopper between 3 cars, Gui keeps a live comparison (payment, MPG, features) by text and nudges toward the in-stock unit with best margin/aged inventory.  
  ↳ *needs:* Inventory + payment calc + aged-inventory days-on-lot flag; comparison render in portal

## 🟣 Superhuman (impossible for a human)
- **Instant 500-lead resurrection blast** — On command, simultaneously calls/texts every dead or aged lead in the CRM (e.g. all 800 untouched 90-day leads) in one evening with a 1:1 personalized pitch tied to the exact car each wanted — impossible for any BDC team.  
  ↳ *needs:* CRM bulk lead export; call.js dial gate with DNC+caps; concurrent Twilio voice/SMS; per-lead inventory match
- **Aged-inventory auto-liquidation engine** — Knows every unit's exact days-on-lot and floorplan cost in real time, and the moment a car crosses 45/60/75 days it auto-targets the highest-probability buyers from the entire lead+sold base to move it before it bleeds carrying cost.  
  ↳ *needs:* Inventory days-on-lot + floorplan interest data; buyer-propensity model; outbound orchestration cron
- **Omniscient cross-inventory match** — In milliseconds cross-references a caller's wants against not just this rooftop but sister-store/group inventory and inbound transport, so 'we don't have it' becomes 'one lands Thursday from our Tampa store.'  
  ↳ *needs:* Multi-rooftop inventory aggregation; in-transit/ordered units feed; group DMS access
- **No-show & deal-fallout prediction** — Predicts which test-drive or F&I appointments will no-show and which signed deals will unwind (financing fallout) and pre-empts each with tailored reminders/backup lenders.  
  ↳ *needs:* Historical appointment + funded-deal outcomes; ML scoring; reminder/backup-lender workflow
- **Real-time script A/B at scale** — Runs live A/B/n tests on opening lines, payment-led vs price-led pitches, and callback timing across thousands of contacts, auto-promoting the winning script per segment nightly.  
  ↳ *needs:* Script variant store; outcome attribution (set appt/sold); bandit optimizer; analytics in portal
- **Perfect lifetime customer memory** — Remembers every prior visit, every car looked at, every kid's name and payment objection across years, so the 3-years-later upgrade call opens with full context no rep would recall.  
  ↳ *needs:* Per-customer long-term memory store keyed to phone/VIN; transcript+sentiment history (call_logs mirror)
- **24/7 instant-up response under 5 seconds** — Every after-hours web/Marketplace/Autotrader lead gets a personalized call+text within seconds at 2am, when speed-to-lead is the single biggest predictor of the sale.  
  ↳ *needs:* Lead-source webhooks (Dealer.com, Autotrader, CarGurus, FB Marketplace); instant trigger to call.js; 24/7 runtime
- **Mass 1:1 payment-personalized outreach** — Sends thousands of individually computed 'your exact upgrade payment' offers — each using that person's real payoff, equity, credit tier and a specific in-stock VIN — at once.  
  ↳ *needs:* F&I deal history + lender rate sheets + live inventory + payment engine; bulk personalized SMS/voice
- **Demand & gross forecasting** — Predicts next month's demand by model/trim from call-and-search volume so the GM stocks and prices ahead of the market instead of reacting.  
  ↳ *needs:* Aggregated inbound intent logs (searches, VOI); trend model; GM dashboard in portal
- **Real-time auction & acquisition co-pilot** — While inbound calls reveal what local shoppers want THIS week, Gui cross-references live wholesale auction runlists (Manheim/ACV/OVE) and tells the used-car manager exactly which units to buy at what max bid to match proven local demand before they hit the lot — turning the BDC phone into a sourcing signal no human can aggregate.  
  ↳ *needs:* Manheim/ACV Auctions/OVE runlist + MMR API; live demand-intent aggregation from calls/searches; max-bid calc vs target gross; buyer alert workflow
- **Every-rooftop simultaneous deal desk** — Negotiates payment-and-terms conversations with hundreds of shoppers at once across voice/SMS/WhatsApp, each held to that store's grid, holdback and aged-unit floor, never fatiguing, never giving up gross out of impatience — a deal desk with infinite seats that never caves at 8pm on the 30th.  
  ↳ *needs:* Per-store pricing grid + min-gross/floor rules + incentive/rebate feed; concurrent multi-channel session state; manager-approval escalation hook
- **Lender-stack auto-shopping for approvals** — On a single applicant Gui simulates structure across the store's entire lender stack — advancing term, down, and trade to find the deal that books, then pre-empts fallout by re-shopping the instant a lender kicks it back, 24/7, faster than any F&I manager working one deal at a time.  
  ↳ *needs:* RouteOne/Dealertrack multi-lender submission + rate sheets/program rules; structure-optimization engine; approval/decline webhook; fallout re-shop trigger
- **Hyper-local market price autopilot** — Continuously watches competitor listings, days-supply, and search demand for each of the store's exact VINs across CarGurus/Autotrader/Cars.com and tells the manager the precise price to win the search-result page and turn the unit — repricing the whole lot daily, a job no human does at scale.  
  ↳ *needs:* Competitor listing scrape + market days-supply + price-rank API (CarGurus IMV/vAuto market data); per-VIN reprice recommendation engine; manager approve-to-publish syndication push
- **Equity-trigger ambush at scale** — Continuously recomputes every owner's real-time equity from live book values + payoff curves and fires the upgrade offer at the exact moment each individual crosses into positive equity or payment-match range — thousands of perfectly-timed 1:1 strikes a human portfolio manager could never track.  
  ↳ *needs:* DMS loan/lease amortization + live Black Book/MMR depreciation feed; per-owner equity recompute cron; payment-match + inventory join; outbound trigger
- **Self-healing zero-missed-revenue net** — Guarantees not one inbound call, web lead, text, or service request is ever lost — instantly catching every after-hours, overflow, and abandoned-on-hold contact across all channels and rooftops at once, reconciling against the CRM nightly to surface anything a human dropped.  
  ↳ *needs:* Twilio overflow/abandoned-call capture + missed-channel webhooks; CRM reconciliation job; gap-alert dashboard; auto-recapture outbound

## 💰 Killer revenue moves
- Speed-to-lead under 5 seconds on every after-hours, weekend, and overflow internet lead — Gui answers and books before any competitor's voicemail picks up; speed-to-first-contact is the single biggest predictor of who wins the sale, and this captures the up the store is bleeding to whoever calls first.
- Mass 1:1 dead-lead + sold-base resurrection blast: in one night Gui works thousands of aged leads and prior buyers with the EXACT car each wanted at their EXACT computed upgrade payment — manufacturing appointments, deals, and scarce trade-in inventory from a database the store already paid for, at a scale no BDC team could touch.
- Equity-trigger ambush + lease-end mining at scale: real-time recompute of every owner's equity fires the perfectly-timed upgrade offer the moment they cross into positive equity or payment-match — driving front-end new-car gross AND creating high-demand used inventory to retail, the highest-margin double-dip in the store.
- Aged-inventory auto-liquidation tied to floorplan cost: the instant a unit crosses 45/60/75 days Gui auto-targets the highest-probability buyers from the entire lead+sold+service base to move it before carrying cost and wholesale loss eat the gross — defending the single biggest silent profit leak on the lot.
- Infinite-seat deal desk that never caves on gross: Gui negotiates payment and terms with hundreds of shoppers at once, every one held to the store's grid and aged-unit floor, never fatiguing or discounting out of impatience at month-end — recovering the gross human reps give away after 6pm.
- Service-bay revenue defense as a trade engine: recall capture, declined-service win-back, and service-to-sales equity conversions turn fixed-ops into both a profit center and a continuous source of off-the-street trades.

## 🔌 Integrations to connect
- DMS / CRM: CDK Global, Reynolds & Reynolds, Tekion, DealerSocket, VinSolutions, Elead, DealerCenter (inventory, deals, ownership, sold base, loan/lease amortization)
- Inventory & syndication: vAuto, HomeNet, Dealer.com, CarGurus, Autotrader, Cars.com, Facebook Marketplace lead webhooks (live stock, days-on-lot, floorplan, market price-rank/IMV)
- Appraisal / valuation: Kelley Blue Book ICO, Black Book, vAuto, Manheim MMR
- Wholesale acquisition: Manheim, ACV Auctions, OVE runlists + MMR (auction sourcing co-pilot)
- F&I / credit: RouteOne, Dealertrack, 700Credit (soft pull), CUDL/lender rate sheets, program/residual rules (multi-lender structure shopping)
- Service scheduling: Xtime, myKaarma, Tekion Service, CDK Service Lane
- Data & compliance: NHTSA vPIC (VIN decode) + recall API, DNC scrub, Twilio Voice/SMS/WhatsApp + Twilio Pay, Stripe payment links

## 📝 Collect at signup (onboarding)
- Rooftop(s) and franchise(s): brand(s) sold, new/used/both, group sister-store list, and address/hours per department (sales/service/parts/finance)
- DMS/CRM in use + API credentials or feed access, plus inventory feed source (vAuto/HomeNet/etc.) so live stock, days-on-lot, floorplan cost, and leads sync day one
- Staff directory & routing: salespeople, BDC, service advisors, finance managers with phones/extensions for warm transfer and round-robin assignment
- Deposit & fee policy: refundable vehicle hold amount, service diagnostic fee, doc fee, and Stripe account for payment links/card-by-voice
- Scheduling rules: test-drive slot length & hold policy, service bay/advisor capacity, loaner/shuttle availability, booking lead time
- Preferred lender(s) + full lender stack, rate sheets/program rules, soft-pull pre-qual link, and PII/SSN handling + consent/DNC/TCPA policy for outbound campaigns
- Desking & pricing rules: payment-led vs price-led, out-the-door quoting rules, pricing grid, minimum/floor gross, holdback, incentive/rebate feed, aged-inventory day thresholds (45/60/75), and manager-approval escalation contacts
- Acquisition + repricing authority: auction accounts (Manheim/ACV/OVE) and max-bid/target-gross rules, plus syndication access and approve-to-publish rules for daily market repricing
- Languages (EN/PT/ES) per market and after-hours behavior (full autonomy vs take-message), plus owner-base + sold-list export consent for resurrection and equity-mining campaigns
