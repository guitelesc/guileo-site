# 🍽️ Restaurants — Gui Agent Playbook

> Gui becomes the restaurant's all-knowing maitre d', host, sommelier, and revenue manager rolled into one — answering every call in under a second, never letting a seat sit empty, charging deposits that kill no-shows, upselling every ticket, remembering every regular forever, and silently re-solving the floor plan and the menu in real time — 24/7/365 in EN/PT/ES, at infinite scale.

## 🟢 Core (table-stakes)
- **Answer every call 24/7** — Picks up on the first ring during the dinner rush, on holidays, and at 2am — no more busy signals or voicemail. Answers hours, location, parking, dress code, and 'are you open today' instantly.  
  ↳ *needs:* Twilio Voice inbound number + ConversationRelay (twilio-voice-conversation-relay) + STT/TTS; per-tenant FAQ/knowledge in Supabase (biz_* in ynihodbknhjirkdogxby)
- **Take & manage reservations** — Books, modifies, and cancels tables by party size, date, time, and seating preference (patio, bar, booth); checks real availability and offers the nearest open slot when full.  
  ↳ *needs:* Bridge /api/agent-schedule + biz_bookings/biz_resources tables; or OpenTable/Resy/SevenRooms API sync; floor/table-count config at signup
- **Take takeout & pickup orders** — Reads the menu aloud, takes the full order with modifiers (no onions, extra cheese), quotes a total and pickup time, and fires the ticket to the kitchen.  
  ↳ *needs:* Menu+modifiers+prices in Supabase; POS/KDS integration (Toast/Square/Clover) or SMS/printer ticket fallback; tax/fee config
- **Charge for orders & deposits** — Sends a Stripe payment link by SMS or takes card-by-voice for prepaid pickup, large-party deposits, and ticketed events; confirms payment before firing the ticket.  
  ↳ *needs:* Stripe (payment links + Twilio Pay for PCI voice capture); deposit policy + amounts per party size in config
- **Answer menu & dietary questions** — Answers 'is the pad thai gluten-free', 'what's vegan', 'how spicy', 'what's in the sauce', allergen and calorie questions, and today's specials — accurately, every time.  
  ↳ *needs:* Structured menu with allergen/dietary/spice tags + daily specials field in Supabase; owner daily-special update via SMS/portal
- **Quote wait times & manage waitlist** — Tells callers the current wait, adds them to the waitlist, and texts them when their table is ready instead of making them stand at the host stand.  
  ↳ *needs:* Live waitlist table + host-stand status input (portal/SMS) or POS waitlist API; Twilio SMS for ready-notification
- **Capture & route messages** — Handles 'is the chef there', lost-and-found, complaints, press/vendor calls, and large-event inquiries — logs them and texts/emails the right staff member instantly.  
  ↳ *needs:* gui_actions log + routing rules (role→phone/email) per tenant; emailTemplates.js for branded notifications
- **Confirm & remind reservations** — Texts a confirmation immediately and a reminder the day before with a one-tap 'confirm or cancel' link, freeing tables the moment a guest backs out.  
  ↳ *needs:* Twilio SMS scheduled jobs (CronCreate) + booking records + confirm/cancel deep links honoring noCall/opt-out

## 🔵 Advanced (proactive automations)
- **Upsell at the point of order** — Suggests the wine that pairs with the entree, adds dessert or an app, and offers the family bundle when it detects a large takeout order — lifting average ticket on every call.  
  ↳ *needs:* Menu margin/pairing rules + party-size logic; upsell script config; POS order context
- **Waitlist-to-cancellation backfill** — The moment a reservation cancels, Gui calls/texts the waitlist for that slot in priority order until the table is rebooked — zero empty tables on a Friday night.  
  ↳ *needs:* Real-time cancellation webhook + ranked waitlist + outbound Twilio call/SMS (call.js dial gate)
- **No-show deposit enforcement & rebooking** — For high-demand slots, collects a refundable hold; on a no-show, captures it per policy and immediately releases the table to a standby guest.  
  ↳ *needs:* Stripe holds/SCA + no-show policy config + booking state machine + standby list
- **Large-party & private-event qualification** — Qualifies private-dining and catering leads (date, headcount, budget, F&B minimum), checks room availability, sends the package PDF, and books a tasting — then hands a warm lead to the owner.  
  ↳ *needs:* Event package data + room calendar + Stripe deposit + emailTemplates.js PDF attach; lead routing
- **Review recovery loop** — After a flagged-negative call or a complaint, Gui follows up with an apology + comp offer to win the guest back before they post a 1-star review.  
  ↳ *needs:* Per-call sentiment (call_logs mirror) + comp/voucher issuance + Stripe/loyalty credit; follow-up SMS
- **Post-dining review solicitation** — Texts happy guests (positive sentiment) a direct Google/Yelp review link 1-2 hours after their reservation time, routing unhappy ones to private feedback instead.  
  ↳ *needs:* Reservation timestamp + sentiment gate + Google review deep link; SMS scheduling
- **Reservation modification chasing** — When a 6-top shrinks to 4 or a guest goes silent, Gui proactively right-sizes or re-confirms so the floor plan stays accurate and tables aren't wasted.  
  ↳ *needs:* Booking records + day-before outbound confirm flow + floor-plan re-optimization logic
- **Special-occasion capture & flagging** — Asks 'any special occasion?' on the booking, tags birthdays/anniversaries, and alerts the kitchen/FOH so the candle and card are ready — guests feel remembered.  
  ↳ *needs:* Occasion field on booking + kitchen/FOH alert (SMS/KDS note); guest profile store
- **Off-hours catering & gift-card capture** — At 11pm when no human is there, Gui takes catering inquiries and sells gift cards over the phone, capturing revenue that used to hit voicemail and vanish.  
  ↳ *needs:* Catering form + gift-card issuance (Square/Toast/Stripe) + SMS delivery of code
- **Third-party delivery margin rescue** — When a caller starts ordering, Gui intercepts them off DoorDash/Uber Eats onto direct pickup or first-party delivery — killing the 30% marketplace commission and capturing the guest's contact data the marketplace would otherwise own.  
  ↳ *needs:* Menu price parity config + first-party delivery zone/fee rules + guest profile capture + 'order direct' SMS link with Stripe checkout

## 🟣 Superhuman (impossible for a human)
- **Mass lapsed-guest win-back blitz** — In one evening Gui personally calls or texts all 500 guests who haven't dined in 90 days, each with a reference to their last order and a tailored comeback offer — impossible for any host to do.  
  ↳ *needs:* Full guest history (POS export) + outbound Twilio at scale + per-guest personalization + DNC/cap compliance (call.js)
- **Predictive no-show scoring** — Scores every reservation's no-show risk from booking lead time, party size, history, and weather, then overbooks high-risk slots exactly enough to run full without bumping guests.  
  ↳ *needs:* Historical booking+no-show data + weather API + ML scoring job; overbooking policy config
- **Demand forecasting & dynamic prompts** — Predicts which nights will be slow days ahead and auto-launches fill-the-room offers, while protecting deposit rules on nights it predicts will sell out.  
  ↳ *needs:* Historical covers + local events/weather feeds + CronCreate trigger + outbound campaign engine
- **Real-time script A/B testing** — Runs continuous experiments on its own greeting, upsell, and deposit-ask wording across thousands of calls, keeping whatever converts highest — optimizing 24/7 with no manager.  
  ↳ *needs:* Multi-variant prompt store + per-call outcome logging + automatic winner-selection logic
- **Perfect eternal guest memory** — Remembers every guest forever — their usual table, allergy, wine, kids' names, last complaint — and greets returning callers by name with their preferences before they ask.  
  ↳ *needs:* Persistent guest profile keyed by phone (Supabase) + caller-ID lookup at call start; cross-visit history
- **Instant omniscient menu/allergen recall** — Cross-references the full live menu, every ingredient, allergen, prep method, and today's 86'd items in milliseconds to answer any dietary question flawlessly across hundreds of simultaneous callers.  
  ↳ *needs:* Structured menu+allergen graph + live 86 board sync from KDS/POS; concurrent call handling
- **Infinite simultaneous call capacity** — Handles 200 calls at once during a Valentine's or Mother's Day rush — every single caller booked, never a busy signal, while a human host could take one call at a time.  
  ↳ *needs:* Concurrent ConversationRelay sessions + scalable booking writes + per-tenant concurrency provisioning
- **Always-on multilingual host** — Switches fluidly between English, Portuguese, and Spanish mid-call to match each caller, 24/7/365, with native-level menu and pairing knowledge no single host could match.  
  ↳ *needs:* Multilingual STT/TTS + translated menu/FAQ per locale; auto language detection
- **Real-time table-yield optimization** — Continuously re-solves the floor plan as bookings flow in — sequencing turns, pacing the kitchen, and slotting walk-ins to squeeze maximum covers out of every seat-hour.  
  ↳ *needs:* Live floor-plan + turn-time model + booking stream + optimization solver
- **Cross-guest trend & 86 prediction** — Spots in real time that the salmon is selling 3x faster than usual tonight and warns the kitchen to prep more or 86 early, and flags emerging dish/sentiment trends across all calls.  
  ↳ *needs:* Aggregated live order stream + anomaly detection + kitchen alert channel
- **Per-guest lifetime-value pricing & comp engine** — Knows each caller's exact lifetime spend and visit frequency in milliseconds and calibrates the offer accordingly — a free dessert for a $40 one-timer, a held VIP window and a comped bottle for a $12k regular — at a precision no host could ever compute live.  
  ↳ *needs:* Per-guest LTV + visit-frequency + margin model in Supabase + caller-ID lookup at ring; dynamic offer-tier logic + Stripe/loyalty credit issuance
- **Dynamic seat-hour yield pricing** — Sets and quotes prepaid-deposit and prix-fixe minimums that flex by predicted demand for every individual seat-hour — a $0 deposit Tuesday 9pm, a $50/head minimum Saturday 7:30pm prime window — re-priced continuously like an airline, which no human could manage table by table.  
  ↳ *needs:* Demand forecast per seat-hour + elasticity model + Stripe variable deposit/minimum + per-slot policy store + booking-flow quote engine
- **Cross-location load balancing** — For multi-unit owners, when one location is slammed and full Gui instantly offers the caller a table at the sister location 8 minutes away with the same menu and their saved preferences — capturing covers that a single-restaurant host would simply lose.  
  ↳ *needs:* Multi-tenant location graph + cross-location availability + shared guest profile + distance/drive-time API; owner opt-in routing rules
- **Reputation-wide sentiment radar & auto-defense** — Monitors every call, review, and complaint across all guests in real time, detects a spike in negative sentiment about a specific dish/server/wait the same night it starts, and alerts the owner with the root cause before it metastasizes into a wave of 1-star reviews.  
  ↳ *needs:* Aggregated call sentiment (call_logs) + Google/Yelp review stream + anomaly/topic clustering + owner push alert (PushNotification); trend dashboard
- **Weather-and-event-triggered autonomous campaigns** — Watches the forecast and local event calendar around the clock and, with zero human input, fires a patio-happy-hour blast when a sunny Thursday is coming or a pre-game prix-fixe to the right guest segment when a concert lands two blocks away — a marketing reflex no staff has time for.  
  ↳ *needs:* Weather + local-events/ticketing feeds + CronCreate + guest-segment selector + outbound Twilio SMS/voice with DNC/cap compliance
- **Self-updating menu intelligence from supplier & cost feeds** — Ingests supplier price and availability feeds, recomputes dish margins overnight, and automatically re-weights which items Gui upsells and which it quietly stops pushing — always steering guests toward tonight's most profitable, in-stock plates with no manager re-writing scripts.  
  ↳ *needs:* Supplier/invoice cost feed + live inventory + margin recompute job (CronCreate) + dynamic upsell-priority store feeding the order/upsell engine

## 💰 Killer revenue moves
- No-show deposit enforcement + instant waitlist/standby backfill: every canceled or no-showed prime-time table becomes a paid cover instead of an empty seat. On a packed Friday/Saturday this alone recovers thousands per weekend — the single biggest dollar leak in any reservation restaurant, plugged.
- Capturing 100% of after-hours and rush-hour calls that today die in voicemail: one missed 8-top, catering order, or private-event lead is hundreds to thousands of dollars; at infinite concurrency Gui never misses one, even when 200 people call at once on Valentine's or Mother's Day.
- Third-party delivery margin rescue: intercepting callers off DoorDash/Uber Eats onto direct orders kills the ~30% marketplace commission AND reclaims guest contact data the marketplace was hoarding — pure margin recovered on every order plus a remarketable customer the restaurant finally owns.
- Per-order upselling tuned by live dish margin (wine pairings, desserts, family bundles) on thousands of orders, compounding into a major margin lift the kitchen never has to think about.
- Mass lapsed-guest win-back + weather/event-triggered fill-the-room campaigns: autonomously refilling slow nights by resurrecting dormant regulars and seizing local demand spikes — turning the restaurant's empty Tuesday into revenue a busy host would never have time to chase.
- Dynamic seat-hour yield pricing + LTV-calibrated comps: airline-style deposit/minimum pricing on prime windows plus exactly-right offers per guest extracts maximum revenue from every seat-hour while spending comp dollars only where they pay back.

## 🔌 Integrations to connect
- Twilio (Voice + ConversationRelay, SMS, WhatsApp Business API, Twilio Pay for PCI card-by-voice)
- Stripe (payment links, deposits/holds with SCA, variable per-slot deposits, gift cards, comp/loyalty credit)
- POS / KDS: Toast, Square, Clover (menu sync, order injection, 86 board, guest history, lifetime-spend export)
- Reservation systems: OpenTable, Resy, SevenRooms (availability + booking sync)
- Google Business Profile + Yelp (hours, review links, review solicitation, live review/sentiment stream)
- Supabase (ynihodbknhjirkdogxby): biz_bookings, biz_resources, guest profiles + LTV, menu+margin, call_logs mirror, multi-location graph
- Weather + local-events/ticketing API (demand, no-show, and campaign triggers)
- Supplier / invoice cost & inventory feed (margin recompute + dynamic upsell priority)
- Email via emailTemplates.js / SendGrid (confirmations, event packages, staff routing, owner alerts)
- Drive-time / maps API (cross-location load balancing)

## 📝 Collect at signup (onboarding)
- Full menu with prices, modifiers, allergen/dietary/spice tags, dish margins, and how daily specials & 86'd items get updated
- Floor plan / table inventory: number of tables, seating zones (patio, bar, booth), party-size limits, and average turn times
- Reservation policy: deposit amounts by party size, no-show/cancellation rules, prime-window definitions, large-party & private-event minimums and packages
- Hours, holiday schedule, location/parking/dress code, and languages to support (EN/PT/ES)
- POS/reservation system in use + API credentials (Toast/Square/Resy/OpenTable) or fallback ticket method (printer/SMS), plus a guest-history/lifetime-spend export
- Stripe account + which charges to enable (prepaid pickup, deposits, variable seat-hour pricing, gift cards) and tax/fee/tip settings
- Staff routing map: who gets catering/event/press/complaint/sentiment-alert notifications and on which number/email
- Upsell rules and brand voice: pairing suggestions, bundles, greeting style, comp/loyalty policy, and review-link URLs (Google/Yelp)
- First-party delivery zones/fees and price parity vs. third-party marketplaces (for delivery margin rescue)
- Sister-location list with menus and drive-time radius (for multi-unit cross-location load balancing), plus supplier/invoice cost feed access if available
