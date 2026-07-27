// Superhuman capability highlights per vertical — sourced from the 13-agent playbooks (db/playbooks).
// Rendered on the /for/:slug pages as the 'no human can do this' section. EN-primary.
export const VERTICAL_SUPERPOWERS = {
  "dental-clinics": {
    superhuman: [
      { name: "Mass Lapsed-Patient Reactivation Blitz", what: "Simultaneously calls and texts all 500–2000 lapsed patients in one night, each with a 1:1 personalized message citing…" },
      { name: "Omniscient Instant Quoting", what: "In milliseconds cross-references the caller's exact insurance plan, remaining benefits, the practice's fee schedule,…" },
      { name: "No-Show Prediction & Pre-emptive Backfill", what: "Scores every upcoming appointment's no-show probability from history, time-of-day, lead-time, and patient pattern, then…" },
      { name: "Self-Optimizing Script A/B Testing", what: "Continuously runs live A/B/n tests on its own greeting, recall offers, reactivation hooks, and reminder copy across…" },
    ],
    revenue: ["Mass Treatment-Plan Resurrection: relentlessly working EVERY open unscheduled treatment…", "Mass overnight lapsed-patient reactivation: calling + texting hundreds-to-thousands of…", "Real-time chair-utilization yield optimization: treating every open chair-hour like an…"],
  },
  "restaurants": {
    superhuman: [
      { name: "Mass lapsed-guest win-back blitz", what: "In one evening Gui personally calls or texts all 500 guests who haven't dined in 90 days, each with a reference to…" },
      { name: "Predictive no-show scoring", what: "Scores every reservation's no-show risk from booking lead time, party size, history, and weather, then overbooks…" },
      { name: "Demand forecasting & dynamic prompts", what: "Predicts which nights will be slow days ahead and auto-launches fill-the-room offers, while protecting deposit rules on…" },
      { name: "Real-time script A/B testing", what: "Runs continuous experiments on its own greeting, upsell, and deposit-ask wording across thousands of calls, keeping…" },
    ],
    revenue: ["No-show deposit enforcement + instant waitlist/standby backfill: every canceled or…", "Capturing 100% of after-hours and rush-hour calls that today die in voicemail: one missed…", "Third-party delivery margin rescue: intercepting callers off DoorDash/Uber Eats onto…"],
  },
  "medical-clinics": {
    superhuman: [
      { name: "Mass simultaneous recall blitz", what: "Calls all 500+ lapsed/overdue patients at once in a single afternoon — something no front desk could do in a month —…" },
      { name: "Instant insurance + price omniscience", what: "In milliseconds cross-references the patient's plan against every accepted payer, the full fee schedule, and live…" },
      { name: "No-show prediction & preemptive overbooking", what: "Scores every upcoming appointment's no-show risk from history, lead time, weather, day-of-week, and insurance type,…" },
      { name: "Demand & staffing forecasting", what: "Predicts call volume and visit demand by hour/day/season (flu surges, allergy season, post-holiday) and tells the owner…" },
    ],
    revenue: ["No-show recovery + same-day cancellation backfill: a clinic losing 15-20 visits/week at…", "Mass recall + population-health gap-closure blitz: reactivating hundreds of…", "Autonomous revenue-cycle closed loop: pre-visit eligibility + denial prevention +…"],
  },
  "law-firms": {
    superhuman: [
      { name: "Mass Simultaneous Lead Capture", what: "Answers an unlimited number of inbound calls at the same instant after a TV/radio/billboard ad or a mass-tort event…" },
      { name: "Millisecond Conflicts + Jurisdiction Omniscience", what: "Cross-references the entire firm's matter history, all 50-state SOL and venue rules, and adverse-party databases in…" },
      { name: "500-Lead Reactivation Blast in One Hour", what: "Simultaneously calls and texts hundreds of dormant leads whose SOL is approaching, each with a personalized script…" },
      { name: "Predictive No-Show & Sign-Rate Forecasting", what: "Predicts which consults will no-show and which leads won't sign, then auto-intervenes (extra reminders, fee waivers,…" },
    ],
    revenue: ["After-hours injury-call capture and sub-30-second retainer sign: PI firms bleed 30-50% of…", "SOL-window dormant-lead reactivation blasts: simultaneously re-engaging hundreds of…", "Mass-tort / class eligibility screening and adverse-event origination radar: instantly…"],
  },
  "real-estate": {
    superhuman: [
      { name: "500-lead database reactivation overnight", what: "Calls and texts the entire dormant lead/past-client database (thousands) simultaneously in one night, re-qualifies…" },
      { name: "Millisecond omniscient listing recall", what: "Cross-references every active MLS listing, price history, comp, HOA, tax record, school rating and inventory level…" },
      { name: "Predictive seller / 'likely-to-list' scoring", what: "Scores every contact and neighborhood for likelihood to sell in the next 6-12 months using equity, tenure, life-event…" },
      { name: "No-show & deal-fall-through prediction", what: "Predicts which showings will no-show and which deals are at risk of collapsing (financing, cold feet) from behavioral…" },
    ],
    revenue: ["Pre-listing radar + self-priced live CMA: Gui monitors every county's probate, divorce,…", "Sub-second interception of 100% of portal inbounds in parallel…", "Overnight reactivation of the entire dead-lead + past-client database (call/text…"],
  },
  "plumbing-hvac": {
    superhuman: [
      { name: "Mass simultaneous storm-surge handling", what: "When a cold snap or heatwave hits and 80 'no heat'/'no AC' calls land in one hour, Gui answers all 80 at once, triages…" },
      { name: "Instant whole-base outbound blast", what: "The night a winter storm is forecast, Gui calls/texts all 5,000 past customers in minutes — 'freeze coming, let us…" },
      { name: "Millisecond omniscient quoting", what: "In the time it takes to greet a caller, Gui has cross-referenced their full job history, the exact installed equipment,…" },
      { name: "Predictive equipment-failure outreach", what: "Gui models each unit's failure risk from brand, age, run-hours, climate, and repair history, then reaches out before it…" },
    ],
    revenue: ["Capture every after-hours emergency that today goes to voicemail and straight to the next…", "Predictive replace-before-it-dies outreach on aging furnaces, AC units, and water heaters…", "Storm/heatwave surge capture: answer 80 simultaneous emergency calls and fill every truck…"],
  },
  "auto-dealerships": {
    superhuman: [
      { name: "Instant 500-lead resurrection blast", what: "On command, simultaneously calls/texts every dead or aged lead in the CRM (e.g. all 800 untouched 90-day leads) in one…" },
      { name: "Aged-inventory auto-liquidation engine", what: "Knows every unit's exact days-on-lot and floorplan cost in real time, and the moment a car crosses 45/60/75 days it…" },
      { name: "Omniscient cross-inventory match", what: "In milliseconds cross-references a caller's wants against not just this rooftop but sister-store/group inventory and…" },
      { name: "No-show & deal-fallout prediction", what: "Predicts which test-drive or F&I appointments will no-show and which signed deals will unwind (financing fallout) and…" },
    ],
    revenue: ["Speed-to-lead under 5 seconds on every after-hours, weekend, and overflow internet lead —…", "Mass 1:1 dead-lead + sold-base resurrection blast: in one night Gui works thousands of…", "Equity-trigger ambush + lease-end mining at scale: real-time recompute of every owner's…"],
  },
  "gyms-fitness": {
    superhuman: [
      { name: "Mass Lapsed-Member Win-Back at Once", what: "Calls and texts all 500+ at-risk/lapsed members simultaneously in a single evening, each with a 1:1 personalized…" },
      { name: "Churn Prediction & Pre-Save", what: "Scores every member's churn risk nightly from attendance decay, payment friction, and sentiment, and intervenes BEFORE…" },
      { name: "No-Show Prediction per Booking", what: "Predicts which trial/PT/class bookings are likely to no-show and pre-emptively overbooks or sends an extra nudge to…" },
      { name: "Instant Omniscient Member Recall", what: "On any call recognizes the member by number and instantly knows their plan, last visit, balance, favorite classes,…" },
    ],
    revenue: ["Churn pre-save engine: nightly churn + habit-threshold scoring with automatic 1:1 save…", "Cancellation-save desk: every inbound cancel call is intercepted with a…", "Mass lapsed-member reactivation: call/text every dormant member in one evening with a…"],
  },
  "ecommerce": {
    superhuman: [
      { name: "Mass lapsed-customer winback in one wave", what: "Calls and texts every dormant customer simultaneously — 500 or 50,000 — each message personalized to their exact last…" },
      { name: "Instant total omniscience per customer", what: "In the first millisecond of contact, cross-references the customer's entire order history, open tickets, shipment…" },
      { name: "Predictive replenishment at population scale", what: "Models the personal consumption rate of every consumable buyer and auto-triggers a reorder nudge at each individual's…" },
      { name: "Churn and no-show prediction", what: "Scores every customer's churn probability and every COD/appointment order's no-show risk continuously, intervening with…" },
    ],
    revenue: ["Abandoned-cart + failed-payment recovery at scale — instant personalized voice/text on…", "Mass lapsed-customer winback waves — reactivating dormant buyers with 1:1 personalized…", "Predictive replenishment + subscription churn saves — auto-timed reorder nudges at each…"],
  },
  "salons-spas": {
    superhuman: [
      { name: "Mass Lapsed-Client Resurrection", what: "Calls and texts all 500+ clients who haven't returned in 90+ days simultaneously in one evening, each message…" },
      { name: "Instant Omniscient Recall", what: "In milliseconds recalls every client's exact color formula, developer volume, last 12 visits, allergies, preferred…" },
      { name: "Predictive No-Show & Demand Forecasting", what: "Predicts tomorrow's no-shows before they happen and overbooks intelligently, and forecasts next month's demand by…" },
      { name: "Always-Awake 3am Capture", what: "Books the 2am scroll-and-book impulse client and the during-your-other-appointment caller every single time — capturing…" },
    ],
    revenue: ["Idle-chair gap filler + whole-book schedule solver: every cancellation, hole, and dead…", "Mass lapsed-client resurrection + churn-risk radar: one overnight personalized call+text…", "Automatic rebooking cadence at the right interval (4-6wk color, 2-3wk lash fill): lifting…"],
  },
  "cleaning-services": {
    superhuman: [
      { name: "500-at-once reactivation blitz", what: "Simultaneously calls and texts every lapsed and one-time customer in the database in one afternoon, each in their…" },
      { name: "Millisecond omniscient quoting", what: "Cross-references the address's sqft, prior jobs at that home, the price grid, current crew load, and competitor rates…" },
      { name: "Predictive no-show scoring", what: "Scores each upcoming booking's no-show/cancel risk from history, lead time, payment status, and weather, and…" },
      { name: "Churn prediction & save", what: "Predicts which recurring clients are about to quit (skip patterns, slower replies, complaints) weeks ahead and…" },
    ],
    revenue: ["Reactivation blitz on the dead list: mass-call/text every lapsed and one-time client in a…", "Zero missed-call capture + instant overflow poaching: every after-hours, overflow, and…", "Recurring-plan conversion at the point of first booking: turning a one-time clean into a…"],
  },
  "accountants": {
    superhuman: [
      { name: "Mass deadline-day blitz", what: "On the morning of each filing/estimate deadline, simultaneously calls and texts all 500+ at-risk clients — those who…" },
      { name: "Instant full-firm omniscience", what: "On any call, cross-references the client's entire history in milliseconds — every prior return, open balance, missing…" },
      { name: "Never-sleeps deadline guardian", what: "Watches every client's every deadline across all entities and jurisdictions 24/7/365 and acts the instant a window…" },
      { name: "Churn & non-return prediction", what: "Predicts which clients won't come back next season (late-payer, slow doc-sender, price-sensitive, went quiet) weeks…" },
    ],
    revenue: ["Firm-wide realization recovery: continuously auditing logged hours and scope against what…", "Quarterly estimated-tax + AR collections at scale: auto-call/text every applicable client…", "Missing-document chaser that finishes returns earlier: stalled returns are unbilled…"],
  },
  "home-contractors": {
    superhuman: [
      { name: "Instant storm surge absorption", what: "When a hailstorm hits and 80 homeowners call in the same hour, Gui answers all 80 simultaneously, qualifies each, and…" },
      { name: "Mass lapsed-customer reactivation", what: "Calls and texts all 500 past customers in a single afternoon with a personalized maintenance or upgrade offer…" },
      { name: "Millisecond omniscient quoting", what: "Cross-references the property's square footage, roof pitch, county permit fees, current material prices, the crew's…" },
      { name: "Never-sleeps midnight emergency desk", what: "At 3am a pipe bursts; Gui answers on the first ring, triages, books the morning crew, takes a deposit, and wakes the…" },
    ],
    revenue: ["Pre-storm + storm-surge capture: Gui harvests demand the moment a hail/wind event is…", "Speed-to-lead domination: answering and booking every missed-call and after-hours lead…", "Margin-aware quote autopilot: silently pricing every bid to the highest point the lead…"],
  },
};
