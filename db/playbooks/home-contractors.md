# 🛠️ Home Contractors — Gui Agent Playbook

> Gui becomes the contractor's never-miss front office AND a tireless second sales rep: he catches every storm-night call, qualifies the $40k jobs from the tire-kickers, quotes and books before the competitor's voicemail even beeps, finances the big tickets, takes the deposit on the spot, and reactivates the whole customer list while the owner sleeps.

## 🟢 Core (table-stakes)
- **24/7 call & text catch** — Answers every inbound call, SMS, and WhatsApp in EN/PT/ES the instant it rings — including nights, weekends, and while the owner is on a ladder or under a sink — so no lead ever hits voicemail.  
  ↳ *needs:* Twilio Voice + Programmable Messaging + WhatsApp Business API; ConversationRelay for low-latency voice; per-tenant number provisioning; gui_actions log
- **Lead intake & qualification** — Captures name, property address, job type (roof/kitchen/HVAC/etc.), scope, timeline, budget range, owner-vs-renter, and how they heard about you, then scores the lead hot/warm/cold against the contractor's ideal-job rules.  
  ↳ *needs:* Intake schema in Supabase (leads table), tenant-config rules for service area + min job size, lead-scoring function
- **Service-area & job-type gating** — Checks the caller's ZIP/address against the contractor's coverage radius and accepted trades, politely declining or referring out-of-area or out-of-scope work instead of wasting an estimate slot.  
  ↳ *needs:* Geocoding API (Google Maps/Mapbox); tenant service_area polygon + radius config; trade whitelist
- **Estimate / site-visit booking** — Books on-site estimate appointments against the right crew or estimator's real calendar, respecting drive-time buffers, day-of-week zones, and double-booking rules.  
  ↳ *needs:* biz_* scheduling engine + /api/agent-schedule bridge; Google Calendar / Jobber / Housecall Pro calendar sync; travel-time buffer config
- **Ballpark quoting by voice/text** — Gives instant good/better/best ballpark ranges for common jobs (e.g. 'a 1,500 sq ft roof replacement runs $X–$Y') from the contractor's own price book, while making clear a firm quote needs a site visit.  
  ↳ *needs:* Per-tenant price_book table (unit costs, sq-ft rates, fixture tiers); quoting function; disclaimer copy
- **Deposit & invoice collection** — Sends a Stripe payment link by SMS for deposits, progress draws, and final invoices, and can take a card by voice for clients who prefer to read the number out.  
  ↳ *needs:* Stripe Payment Links + Connect per tenant; PCI-safe voice card capture (Twilio <Pay>); invoice/deposit records
- **Quote follow-up sequence** — Automatically chases sent estimates — 'Did you get a chance to review the quote for your bathroom?' — across SMS/voice/WhatsApp on a cadence until the client signs, declines, or asks to pause.  
  ↳ *needs:* call.js dial gate (DNC+caps); follow-up scheduler (cron); quote-status field tied to e-sign/CRM
- **Appointment reminders & confirmations** — Confirms estimate and job-start appointments 24h and 1h out, captures reschedules, and re-offers freed slots so estimators aren't driving to no-shows.  
  ↳ *needs:* Scheduling engine reminder hooks; two-way SMS; reschedule flow; gate caps
- **Emergency triage & dispatch** — Detects burst pipes, no-heat, roof leaks, gas smell, sewage backups; flags true emergencies, captures address + severity, and escalates to the on-call tech immediately while booking same-day.  
  ↳ *needs:* Intent/severity classifier; on-call routing config + escalation contact; PushNotification/SMS to owner; emergency surcharge logic
- **FAQ & trust answers** — Answers licensed/bonded/insured status, warranty terms, financing availability, areas served, brands installed, and 'how soon can you come out' from the contractor's own knowledge base.  
  ↳ *needs:* Tenant knowledge_base (license #, insurance, warranty, financing partner, brands); retrieval over KB
- **Lead source & call logging** — Logs every call/text with transcript, sentiment, job type, value, and source (Google, yard sign, referral, Angi) into the portal so the owner sees exactly where work comes from.  
  ↳ *needs:* call_logs mirror in ynihodbknhjirkdogxby; transcript+sentiment pipeline; source attribution field
- **After-hours overflow & spillover** — Acts as overflow when the office line is busy or staff are on other calls, so simultaneous callers during a hailstorm all get answered at once instead of bouncing.  
  ↳ *needs:* Twilio forwarding/SIP overflow rules; concurrent-call handling; tenant business-hours config
- **Instant web-form & missed-call callback** — The moment a web form is submitted or a call is missed, Gui calls or texts the lead back within seconds to engage them while intent is hot, instead of the lead sitting in an inbox for hours.  
  ↳ *needs:* Web form + missed-call webhooks; instant outbound trigger via call.js gate; speed-to-lead timer

## 🔵 Advanced (proactive automations)
- **Photo-driven scoping** — Texts the homeowner a link to snap photos/video of the roof, panel, leak, or kitchen, then uses them to pre-classify scope and tighten the ballpark before anyone drives out.  
  ↳ *needs:* MMS/WhatsApp media intake + upload link; vision model for damage/scope tagging; media stored per lead
- **Smart route-packing scheduler** — Clusters estimate and job appointments geographically by day so the crew does North County Tuesday, South County Wednesday — cutting windshield time and fitting more jobs per week.  
  ↳ *needs:* Geocoded appointments; routing/optimization (Google Routes API); scheduling engine zone-day rules
- **Financing pre-qualification** — For big-ticket jobs, offers and walks clients through a financing application link (Hearth/Wisetack/GreenSky) so a $25k re-roof doesn't die on sticker shock.  
  ↳ *needs:* Financing partner API/links (Wisetack/Hearth/Sunlight); job-value threshold trigger; status tracking
- **Permit & inspection reminders** — Tracks which jobs need permits and proactively reminds the owner to pull/renew them and schedule inspections so jobs don't stall.  
  ↳ *needs:* Job-stage tracker; permit checklist per job type/jurisdiction; cron reminders
- **Review & referral harvesting** — After job completion, asks happy customers for a Google/Facebook review with a direct link, and asks for a neighbor referral while satisfaction is peak.  
  ↳ *needs:* Job-complete trigger from CRM; Google review deep-link; referral capture + reward tracking; sentiment gate
- **Subcontractor & supplier coordination** — Texts subs and suppliers to confirm availability, material drop times, and dumpster/equipment delivery windows, then reflects confirmations on the job schedule.  
  ↳ *needs:* Vendor contact directory; outbound SMS; calendar write-back; confirmation parsing
- **Seasonal & maintenance reactivation** — Reaches back to past customers at the right moment — gutter cleaning before fall, AC tune-up before summer, deck reseal at 2 years — to resurface dormant revenue.  
  ↳ *needs:* Customer history + install-date data; seasonal trigger calendar; campaign sender via gate
- **Change-order capture** — When a homeowner asks mid-job for an add-on ('can you also do the powder room?'), Gui logs the change-order request, prices it from the book, and routes it to the owner for approval.  
  ↳ *needs:* Change-order record linked to job; price_book lookup; owner approval flow; e-sign add-on
- **Warranty & callback handling** — Recognizes warranty/callback calls, pulls the original job and warranty terms, and books a no-charge or covered service visit without the owner having to dig through records.  
  ↳ *needs:* Job history lookup; warranty terms in KB; warranty-flagged booking type
- **Weather-aware rescheduling** — Watches the forecast for exterior jobs (roofing, paint, concrete) and proactively offers to move rained-out days, texting affected clients before they call angry.  
  ↳ *needs:* Weather API (NWS/OpenWeather) by job site; exterior-job tag; bulk reschedule flow
- **Material price-aware quoting** — Adjusts ballpark ranges when lumber/shingle/copper prices move so quotes don't undercut margin during volatile supply periods.  
  ↳ *needs:* Material index feed or supplier price sync; price_book multipliers; quoting function
- **Insurance-claim roof/restoration assist** — For storm-damage jobs, captures the homeowner's insurance carrier, claim number, and deductible, explains the claim process, and packages photos + measurements into a claim-ready file for the adjuster.  
  ↳ *needs:* Claim-intake schema; carrier list; deductible capture; photo+measurement bundling; adjuster-handoff doc generator

## 🟣 Superhuman (impossible for a human)
- **Instant storm surge absorption** — When a hailstorm hits and 80 homeowners call in the same hour, Gui answers all 80 simultaneously, qualifies each, and books estimates — something no human office could ever do.  
  ↳ *needs:* Horizontally-scaled concurrent Twilio voice/SMS sessions; stateless intake workers; queue-free architecture
- **Mass lapsed-customer reactivation** — Calls and texts all 500 past customers in a single afternoon with a personalized maintenance or upgrade offer referencing their specific past job, instead of a postcard that gets thrown out.  
  ↳ *needs:* Full customer DB; per-record personalization; call.js gate with caps+DNC; outbound campaign engine
- **Millisecond omniscient quoting** — Cross-references the property's square footage, roof pitch, county permit fees, current material prices, the crew's calendar, and the contractor's margin rules in milliseconds to produce a tailored ballpark before the human even finishes describing the job.  
  ↳ *needs:* Property data API (ATTOM/Regrid); permit-fee DB; live price feed; price_book + margin engine; sub-second retrieval
- **Never-sleeps midnight emergency desk** — At 3am a pipe bursts; Gui answers on the first ring, triages, books the morning crew, takes a deposit, and wakes the on-call tech only if it's a true emergency — every night, no fatigue, no missed call.  
  ↳ *needs:* 24/7 always-on; emergency classifier; on-call escalation; voice payment; deposit record
- **Predictive no-show & cancel scoring** — Predicts which estimate appointments will no-show (based on lead source, response speed, time-to-appointment, prior behavior) and pre-emptively over-books or sends extra nudges to protect crew utilization.  
  ↳ *needs:* Historical appointment outcome data; ML scoring model; reminder-intensity rules tied to score
- **Self-optimizing script A/B tests** — Runs live A/B tests on its own greeting, qualifying questions, quote framing, and follow-up timing across thousands of conversations, auto-keeping whatever booking/close rate wins — improving every week with zero human tuning.  
  ↳ *needs:* Script variant manager; per-conversation assignment + outcome tracking; bandit optimizer; analytics store
- **Demand & capacity forecasting** — Forecasts the next 8 weeks of lead volume by trade and ZIP from weather, seasonality, and call trends, telling the owner when to hire a second crew or pull marketing back so they never over- or under-staff.  
  ↳ *needs:* Time-series forecasting over call_logs + weather + seasonality; capacity model; owner dashboard
- **Perfect lifetime customer memory** — Remembers every customer forever — every job, color, brand, gate code, dog's name, payment history, complaint — so a returning caller is greeted with full context a human employee who quit years ago took with them.  
  ↳ *needs:* Persistent per-customer profile store keyed by phone; full interaction history; instant recall at call start
- **Real-time competitive speed-to-lead** — Responds to every web-form and missed-call lead within seconds 24/7, beating competitors who call back hours later — and statistically wins the job that goes to whoever calls first.  
  ↳ *needs:* Web form + missed-call webhooks; instant outbound trigger; speed-to-lead SLA monitor
- **Margin-protecting auto-triage of bad jobs** — Instantly identifies and politely declines the unprofitable jobs (out-of-area, below min, scope-creep risk, chronic non-payers) across every channel at once, so the owner's calendar fills only with jobs worth doing.  
  ↳ *needs:* Service-area + min-job + payment-history rules; cross-channel enforcement; referral-out flow
- **Omnichannel single-brain continuity** — A customer who calls, then texts, then WhatsApps picks up exactly where they left off every time, with one unified memory — no human juggling three apps could maintain this across hundreds of clients.  
  ↳ *needs:* Unified conversation thread keyed by identity across voice/SMS/WhatsApp; shared state store
- **Mass-personalized seasonal blasts** — Sends thousands of 1:1 messages where each references that customer's exact install date, product, and next recommended service — at a scale and specificity a human marketer could never hand-craft.  
  ↳ *needs:* Customer history DB; template personalization engine; compliant bulk sender with caps/DNC
- **Pre-storm outbound demand harvesting** — The instant a hail or wind event is forecast for a ZIP, Gui proactively calls and texts every past customer and warm lead in the impact cone offering a free inspection — booking the roof season hours BEFORE the storm even lands, while competitors are still asleep.  
  ↳ *needs:* Weather/storm-track API (NWS/Tomorrow.io polygons); customer+lead geo-index; pre-event trigger; outbound campaign engine with caps/DNC
- **Real-time margin-aware quote autopilot** — At the moment of quoting, Gui recomputes the live job margin from current material indices, crew labor cost, drive-time fuel, and permit fees, and silently nudges each quote to the highest price the lead will still accept (from won/lost price-elasticity history) — protecting and lifting margin on every single bid without a human estimator.  
  ↳ *needs:* Live material price feed + labor cost config; per-quote cost engine; won/lost price-elasticity model; dynamic-pricing guardrails per tenant
- **Autonomous accounts-receivable collector** — Tracks every unpaid invoice and progress draw across all jobs and runs a relentless, polite, escalating multi-channel collection sequence (text, voice, payment link, then owner-flag) 24/7 — recovering the tens of thousands in aged receivables a busy owner never has time to chase.  
  ↳ *needs:* Invoice/AR ledger synced from QuickBooks/Jobber; aging buckets; escalation cadence via call.js gate; Stripe pay-link per invoice; owner-escalation flag
- **Cross-tenant demand & price intelligence** — Anonymously learns from millions of calls and won/lost quotes across every contractor on the network to tell each owner the winning price band, fastest-closing scripts, and rising-demand trades in their exact market — market intelligence no single shop could ever gather alone.  
  ↳ *needs:* Privacy-safe cross-tenant aggregation pipeline; anonymized quote/outcome warehouse; per-market benchmark model; owner insights dashboard
- **Always-listening upsell & cross-trade detection** — During any call, Gui detects adjacent opportunities a homeowner mentions in passing ('the gutters are also sagging', 'AC has been weak') and instantly attaches priced add-ons or a second-trade lead to the job — capturing revenue a busy human rep would let slip past.  
  ↳ *needs:* Real-time conversation intent extraction; multi-trade price_book; add-on/lead-spawn logic; owner approval surface
- **Instant multi-language jobsite interpreter** — Bridges English-speaking homeowners and Spanish/Portuguese-speaking crews in real time on a 3-way call, translating both directions instantly so scope, gate codes, and change-orders are never lost in translation — a live bilingual dispatcher on every job, around the clock.  
  ↳ *needs:* Real-time speech translation pipeline (EN/ES/PT); 3-way Twilio conferencing; per-utterance translation; transcript log per job

## 💰 Killer revenue moves
- Pre-storm + storm-surge capture: Gui harvests demand the moment a hail/wind event is forecast AND absorbs 50-100 simultaneous calls when it lands — booking an entire roofing/restoration season's worth of $15k-$40k jobs in a single day that one office line would drop straight to voicemail. This alone can be a six-figure swing per storm.
- Speed-to-lead domination: answering and booking every missed-call and after-hours lead within seconds wins the 20-40% of inbound that today goes to voicemail and the competitor — the single biggest revenue leak in contracting, recovered 24/7.
- Margin-aware quote autopilot: silently pricing every bid to the highest point the lead will still accept (from won/lost history) and protecting margin against material spikes adds pure profit to thousands of quotes a year — not more jobs, but materially more dollars per job.
- Relentless quote follow-up close-rate lift: multi-channel chasing of every sent estimate until sign/decline recovers the large share of $10k-$50k quotes that normally die from zero follow-up — often doubling close rate on outstanding bids.
- Mass reactivation + seasonal upsell of the whole customer list: one afternoon of personalized maintenance/upgrade/re-roof outreach to all past customers resurfaces dormant high-margin work at near-zero cost, turning a dead list into a recurring revenue engine.
- Financing pre-qual + on-the-spot deposit capture: walking big-ticket clients into Wisetack/Hearth financing on the call AND taking the deposit by Stripe link or voice card before they cool off rescues high-value jobs that die on sticker shock and locks the crew's calendar.
- Autonomous AR collection: recovering aged receivables and progress draws that a swamped owner never chases — often tens of thousands in already-earned cash pulled back into the business per year with zero owner effort.

## 🔌 Integrations to connect
- Twilio (Programmable Voice + ConversationRelay, SMS/MMS, WhatsApp Business API, real-time translation + 3-way conferencing) for omnichannel, voice card capture, and live interpreting
- Stripe (Payment Links + Connect) for deposits, progress draws, invoices, AR collection, and pay-by-voice
- Field-service CRMs: Jobber, Housecall Pro, ServiceTitan, Buildertrend / JobNimbus (roofing) for jobs, scheduling, invoicing, and AR sync
- Google Calendar / Google Business Profile (calendar sync + review deep-links + call-from-listing)
- Google Maps / Mapbox + Google Routes API for geocoding, service-area gating, and route-packing
- Property & permit data: ATTOM / Regrid (parcel, sq ft, roof pitch) and county permit-fee sources
- Financing partners: Wisetack, Hearth, Sunlight Financial, GreenSky
- E-signature: DocuSign / Jobber e-sign for estimates and change orders
- Weather & storm tracking: NWS / OpenWeather / Tomorrow.io for exterior-job rescheduling, storm-demand triggers, and pre-storm impact polygons
- QuickBooks / Xero for invoice, payment, and AR reconciliation
- Material price feeds / supplier catalogs (e.g. ABC Supply, SRS, lumber/copper indices) for margin-aware quoting
- Insurance claim workflow: carrier directory + adjuster-handoff document generation for storm/restoration jobs
- Supabase (ynihodbknhjirkdogxby) as the system of record: leads, jobs, call_logs, price_book, customer profiles, AR ledger
- Lead sources: Angi, Thumbtack, Yelp, web-form and missed-call webhooks for instant speed-to-lead

## 📝 Collect at signup (onboarding)
- Trades offered and accepted job types, with minimum job size / value the contractor will take (so Gui filters tire-kickers)
- Service-area definition: ZIP list or radius/polygon from base address, plus any day-of-week geographic zones for routing
- Price book: ballpark unit rates by job (per sq ft roofing, per fixture plumbing, kitchen/bath tiers, good/better/best) plus margin floors and dynamic-pricing guardrails (max % above floor Gui may quote)
- Calendar & crews: which calendars/estimators to book against, working hours, drive-time buffers, emergency on-call contact and escalation rules
- License #, bonded/insured details, warranty terms, brands installed, and financing partner — the trust facts Gui must state accurately
- Stripe account + deposit policy (flat or % deposit, when to collect), invoice terms, and AR collection cadence + when to escalate to the owner
- Connected CRM (Jobber/Housecall/ServiceTitan/etc.) and accounting (QuickBooks/Xero) credentials and which fields map to jobs/leads/invoices
- Greeting persona, business name pronunciation, languages to prioritize (EN/PT/ES), crew language for jobsite interpreting, and DNC/quiet-hours preferences for outbound
- Existing customer list import (name, phone, address, past job, install date, payment history) so day-one reactivation, AR recovery, and lifetime-memory work immediately
- Lead-source list to attribute (Google, yard signs, referrals, Angi/Thumbtack), emergency keywords/surcharge policy, and storm-event ZIP cone preferences for pre-storm outreach
- Insurance-claim handling preference (carriers worked with, deductible policy, adjuster contact) for storm/restoration jobs
