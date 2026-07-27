# 🔧 Plumbing & HVAC — Gui Agent Playbook

> Gui becomes the never-sleeping dispatcher who answers every burst-pipe call at 3am, fills every truck to the brim, predicts which furnace dies next winter, and turns one-time emergencies into lifetime maintenance-plan members — across English, Portuguese, and Spanish, at a scale and speed no human office could survive.

## 🟢 Core (table-stakes)
- **24/7 emergency call answer + triage** — Answers every inbound call/text in EN/PT/ES, distinguishes a true emergency (burst pipe, no heat in winter, gas smell, sewage backup, no AC in a heatwave) from routine work, and gives safety instructions like 'shut off the main water valve' or 'leave the house and call the gas company' while booking the truck.  
  ↳ *needs:* Twilio Voice + ConversationRelay (STT/TTS), intent/triage classifier with plumbing/HVAC emergency taxonomy, business hours + emergency-rate config in onboarding
- **Job booking into dispatch calendar** — Captures service address, problem description, system type (gas furnace, heat pump, tankless water heater, etc.), and books a 2-hour arrival window into the correct technician's route, respecting skills and zones.  
  ↳ *needs:* Google Calendar / ServiceTitan / Housecall Pro / Jobber API, biz_* scheduling engine + /api/agent-schedule bridge, technician skills+zones table
- **Dispatch / trip fee + estimate quoting** — Quotes the service-call/dispatch fee up front, gives flat-rate price ranges for common jobs (water heater swap, drain clear, AC tune-up, capacitor replacement) from the owner's price book, and explains diagnostic-then-quote policy.  
  ↳ *needs:* Flat-rate price book table per tenant, quoting logic in agent prompt, disclaimer/terms config
- **Collect deposit / dispatch fee by card** — Takes the trip fee or job deposit over the phone (card-by-voice, PCI-safe) or sends a Stripe SMS payment link, and marks the job paid in the schedule.  
  ↳ *needs:* Stripe + Twilio Pay (PCI <Say>/<Pay> DTMF capture), SMS link generator, call.js dial gate, payment status write-back to job
- **Reschedule / cancel self-service** — Lets a customer move or cancel a booked job by phone/text, frees the slot back to the route instantly, and honors cancellation-fee policy.  
  ↳ *needs:* Scheduling engine reschedule/hold endpoints, cancellation policy config, SMS confirmation
- **Customer + property record lookup** — Recognizes a returning caller by phone, pulls their address, installed equipment (brand, model, install date, warranty), and past jobs so they don't repeat themselves.  
  ↳ *needs:* Customer + equipment-per-property table, CRM/FSM sync (ServiceTitan/Housecall Pro), caller-ID match
- **Appointment reminders + on-my-way texts** — Sends day-before and morning-of reminders, plus a 'technician is 30 minutes out' text with the tech's name/photo, cutting no-shows and 'where is he' calls.  
  ↳ *needs:* Scheduled-tasks/cron, technician ETA feed or manual dispatch trigger, branded SMS templates
- **After-job follow-up + review request** — Texts after completion to confirm the fix held, asks for a Google review with a direct link, and routes any complaint to the owner before it becomes a public 1-star.  
  ↳ *needs:* Job-complete webhook from FSM, Google Business review link, sentiment routing, gui_actions log
- **Overflow / missed-call rescue** — Picks up when the office line is busy or unanswered (techs in the field, owner on a roof), so no lead ever hits voicemail and bleeds to the next plumber on Google.  
  ↳ *needs:* Twilio number forwarding / failover, voicemail-drop fallback, lead.js capture with noCall honoring
- **Spam / sales-call filtering** — Screens out robocalls, supplier solicitations, and warranty scams so the owner only sees real customers and real emergencies.  
  ↳ *needs:* Twilio Lookup phone intelligence, known-spam list, intent classifier
- **Photo / video intake by MMS/WhatsApp** — Asks the customer to send a photo of the leaking valve, the furnace model plate, or the error code on the thermostat, so the tech rolls with the right part the first time.  
  ↳ *needs:* Twilio MMS/WhatsApp media receive, media storage bucket, attach-to-job in FSM

## 🔵 Advanced (proactive automations)
- **Right-part-first-trip prediction** — From the photo + equipment record + symptom, Gui guesses the likely failed part (e.g. 'AO Smith 50gal, 11 years old, no hot water → likely thermocouple or gas valve') and flags it on the work order so the tech loads the part and avoids a second trip.  
  ↳ *needs:* Equipment age/model DB, parts-by-symptom knowledge base, supplier parts catalog, work-order notes field
- **Maintenance-plan / membership upsell** — At the right moment (after a repair, or in pre-season), Gui pitches the annual maintenance membership (2 tune-ups, priority service, discount) and enrolls the customer on a recurring Stripe subscription.  
  ↳ *needs:* Stripe subscriptions, membership plan config per tenant, upsell-timing rules, enrollment write-back
- **Seasonal tune-up campaign** — Each spring (AC) and fall (heating), Gui proactively texts/calls the whole customer base to book pre-season tune-ups before the rush, smoothing demand into slow weeks.  
  ↳ *needs:* Customer list segmentation, seasonal cron triggers, outbound call/SMS via call.js caps+DNC, booking flow
- **Warranty + recall watch** — Tracks each installed unit's warranty expiry and known manufacturer recalls, and alerts the customer ('your compressor warranty ends in 60 days — want a check-up while it's still covered?').  
  ↳ *needs:* Equipment warranty dates DB, manufacturer recall feed, scheduled-tasks, outbound notify
- **Dynamic emergency surcharge handling** — Knows the after-hours/weekend/holiday rate and overtime windows, quotes them transparently, and can offer 'book first thing tomorrow at the standard rate vs. tonight at emergency rate' to capture price-sensitive jobs.  
  ↳ *needs:* Rate-card by time-window config, current datetime, next-available-slot lookup
- **Smart route-aware scheduling** — Books new jobs to minimize windshield time by clustering them near already-scheduled stops and within each tech's zone, fitting more billable jobs per day.  
  ↳ *needs:* Geocoding (Google Maps API), tech route data, scheduling engine zone/cluster logic
- **Permit + inspection coordination** — For jobs needing a permit (water heater, repipe, new furnace), Gui flags it, explains the cost/timeline, and schedules the follow-up inspection appointment.  
  ↳ *needs:* Permit-required job-type rules, jurisdiction notes config, second-appointment booking
- **Financing offer for big-ticket jobs** — When a quote crosses a threshold (new HVAC system, full repipe, $5k+), Gui offers monthly financing and texts the application link, turning sticker-shock walkaways into closed sales.  
  ↳ *needs:* Financing partner API (Wisetack/GreenSky/Synchrony), threshold config, SMS link
- **Lapsed-customer win-back** — Identifies customers not seen in 12-18 months and reaches out with a tune-up offer or check-in, reviving dormant revenue with no owner effort.  
  ↳ *needs:* Last-service-date query, win-back segment, outbound campaign engine, offer config
- **Lead-source + ROI attribution** — Asks/infers how each caller found the business (Google, yard sign, referral, truck) and tells the owner which marketing actually produces booked jobs vs. tire-kickers.  
  ↳ *needs:* Lead-source capture field, attribution dashboard in portal, gui_actions analytics
- **Pre-visit prep + access logistics** — Confirms gate codes, dog warnings, parking, whether anyone 18+ will be home, and where the unit/panel is located, so the tech isn't locked out or stuck.  
  ↳ *needs:* Job custom-fields, pre-visit checklist prompt, SMS confirmation thread
- **Supplier / on-call tech escalation** — For a true emergency with no available tech, Gui can ring the on-call technician or the owner directly, brief them in one sentence, and warm-transfer the customer.  
  ↳ *needs:* On-call rotation config, Twilio warm transfer/conference, escalation priority rules
- **Rebate + tax-credit capture on installs** — On new high-efficiency HVAC/heat-pump/tankless quotes, Gui auto-surfaces applicable utility rebates and federal/state tax credits (e.g. IRA 25C heat-pump credits), bakes the net price into the pitch, and pre-fills the rebate paperwork — making your bid hundreds-to-thousands cheaper than the competitor who didn't mention it.  
  ↳ *needs:* Rebate/tax-credit rules DB by zip+utility+equipment efficiency, install-quote trigger, document pre-fill, SMS link
- **Insurance-claim assist for water damage** — For burst-pipe/flood/sewage jobs, Gui captures photos, timestamps, and a damage description formatted for the homeowner's insurance claim, and provides the documentation packet — making you the contractor the adjuster (and customer) trusts and re-hires.  
  ↳ *needs:* Media capture + storage, claim-doc template generator, job-type trigger, branded PDF/SMS delivery

## 🟣 Superhuman (impossible for a human)
- **Mass simultaneous storm-surge handling** — When a cold snap or heatwave hits and 80 'no heat'/'no AC' calls land in one hour, Gui answers all 80 at once, triages severity, and fills every truck optimally — no hold music, no lost lead, while a human office would drop 70 of them.  
  ↳ *needs:* Concurrent Twilio call handling at scale, real-time slot-allocation engine, severity-priority queue
- **Instant whole-base outbound blast** — The night a winter storm is forecast, Gui calls/texts all 5,000 past customers in minutes — 'freeze coming, let us winterize your pipes / here's how to drip your faucets' — booking tune-ups and preventing emergencies at a scale no phone bank could touch.  
  ↳ *needs:* Bulk outbound via call.js (DNC+caps+pacing), weather API trigger, segmented personalized scripts
- **Millisecond omniscient quoting** — In the time it takes to greet a caller, Gui has cross-referenced their full job history, the exact installed equipment, live parts pricing, the owner's flat-rate book, current tech availability, and warranty status — quoting and booking with knowledge no human dispatcher could hold in their head.  
  ↳ *needs:* Unified customer+equipment+pricing+schedule store, sub-second query layer, supplier price feed
- **Predictive equipment-failure outreach** — Gui models each unit's failure risk from brand, age, run-hours, climate, and repair history, then reaches out before it dies — 'your 14-year-old furnace is statistically due; replace now at off-season pricing' — manufacturing demand from the future.  
  ↳ *needs:* Equipment lifecycle/failure model, fleet-wide install data, predictive cron, outbound offer flow
- **Self-optimizing scripts via live A/B** — Gui runs continuous A/B tests on its own greeting, quoting, and membership-pitch wording across thousands of calls, keeping whatever books more jobs and sells more memberships — improving itself weekly with no manager.  
  ↳ *needs:* Script-variant framework, per-variant outcome tracking, auto-promote winner logic, portal dashboard
- **No-show + cancellation prediction** — Gui scores each booked job's no-show risk (history, lead time, job type, weather) and pre-empts it with an extra confirm, a deposit, or by double-stacking the slot — protecting truck utilization a human can't forecast.  
  ↳ *needs:* No-show risk model on historical job outcomes, confirmation/deposit escalation rules, overbook logic
- **Perfect lifetime memory of every property** — Forever remembers every valve location, every past repair, every 'the shutoff is behind the dryer', every customer preference and quirk across years and staff turnover — institutional memory that survives every employee who quits.  
  ↳ *needs:* Persistent per-property+customer knowledge store, full transcript+job archive, retrieval at call time
- **Real-time demand + dynamic capacity pricing** — Sees demand spiking citywide in real time and dynamically adjusts available emergency slots and surcharge offers, steering low-urgency jobs to tomorrow and reserving capacity for the highest-value emergencies — yield management no human runs live.  
  ↳ *needs:* Live booking-volume signal, dynamic slot/price engine, owner-set guardrails, weather+seasonality inputs
- **1:1 mass-personalized maintenance reminders** — Sends each of thousands of customers a uniquely personalized message referencing their specific unit, last service date, and home ('your Trane heat pump's last tune-up was 13 months ago') — individually tailored at a scale impossible by hand.  
  ↳ *needs:* Per-customer equipment+history merge fields, bulk personalization engine, branded SMS/WhatsApp templates
- **Always-on multilingual full coverage** — Never sleeps, never takes lunch, never gets overwhelmed — covers 2am Sunday gas-leak calls in Portuguese and Tuesday-rush English/Spanish simultaneously, every day of the year, at the cost of one tool.  
  ↳ *needs:* Always-on infra, EN/PT/ES voice models, 100% uptime failover, no per-seat staffing
- **Instant warranty + recall cross-check at scale** — The moment a manufacturer issues a recall, Gui instantly identifies every affected unit across the entire customer base and proactively contacts those owners the same day — a search-and-notify sweep a human couldn't finish in a month.  
  ↳ *needs:* Equipment model/serial DB, recall feed ingestion, mass-match query, outbound notify pipeline
- **Capacity-aware overflow into idle hours** — Continuously detects under-booked days/weeks weeks ahead and auto-generates outreach to fill them (deferred maintenance, soft-sell tune-ups) so trucks are never idle — load-balancing the calendar across the whole year automatically.  
  ↳ *needs:* Forward-looking utilization forecast, idle-slot detector, targeted fill-campaign generator
- **Hyper-local micro-weather pipe-freeze targeting** — Gui ingests street-level forecast and overnight low data per customer's exact address, and the night a hard freeze will hit only the north-facing/higher-elevation neighborhoods, it warns and books only those at-risk homes — pinpoint outreach no human could compute parcel-by-parcel across thousands of addresses.  
  ↳ *needs:* Per-address geocoding + micro-weather/elevation API, freeze-risk model per property, targeted outbound segment, scheduled cron
- **Whole-fleet competitive-price re-benchmarking** — Gui continuously re-prices the owner's entire flat-rate book against live local-competitor and supplier-cost signals, alerting the owner the day a water-heater swap is underpriced by $200 or a drain clear is leaving margin on the table — repricing thousands of line items faster and more often than any owner ever could.  
  ↳ *needs:* Live supplier cost feed, competitor-price signal source, margin-target config, repricing engine + owner alert
- **Instant first-second caller-need anticipation** — Before the caller finishes their first sentence, Gui has matched the inbound number to the property, seen it's a 16-year-old AC in a 99°F heatwave, pre-loaded the likely-failed-capacitor part and the nearest available tech, and is already quoting — anticipating the entire call from data the customer hasn't even said yet.  
  ↳ *needs:* Caller-ID + property + equipment join at ring time, real-time weather + symptom-prior model, pre-warmed quote+slot cache
- **Cross-tenant anonymized failure-pattern intelligence** — Gui learns from failure patterns across the entire Guileo network of HVAC/plumbing tenants — so a spike in a specific furnace model's heat-exchanger failures or a bad batch of water heaters is detected network-wide and proactively flagged to every owner with affected units in the field, intelligence no single shop could ever see.  
  ↳ *needs:* Privacy-safe cross-tenant aggregated failure store, model/serial pattern-detection, anonymized signal sharing with owner consent, alert pipeline
- **24/7 live remote diagnostic guidance + truck-roll deflection** — For non-emergencies, Gui walks the customer through a live video/photo-guided check (reset the breaker, replace the thermostat batteries, flip the float switch, relight the pilot) and resolves the trivial ones on the spot — saving a wasted truck-roll and freeing that slot for a paying job, instant simultaneous guided support no human staff could give every caller at once.  
  ↳ *needs:* Twilio video/MMS guided flow, symptom-to-self-fix decision tree, equipment-specific step library, deflection-vs-dispatch logic, follow-up confirm
- **Continuous overnight schedule self-optimization** — Every night Gui re-solves the next 14 days of routing across all trucks as new jobs, cancellations, and weather land — re-sequencing stops, rebalancing zones, and proactively offering customers better windows — a full combinatorial route re-optimization no human dispatcher reruns nightly.  
  ↳ *needs:* Multi-vehicle routing optimizer, nightly cron, geocoded job + tech-zone data, customer reschedule-offer flow with guardrails

## 💰 Killer revenue moves
- Capture every after-hours emergency that today goes to voicemail and straight to the next plumber on Google — each recovered no-heat/burst-pipe/sewage call is a $400-$1,500 job that was 100% lost, and Gui catches all of them 24/7 in three languages while competitors sleep.
- Predictive replace-before-it-dies outreach on aging furnaces, AC units, and water heaters at off-season pricing, with rebates and tax credits already baked into the net price — turning $300 repairs into $8,000-$18,000 system replacements the customer was going to buy anyway, from you instead of the competitor.
- Storm/heatwave surge capture: answer 80 simultaneous emergency calls and fill every truck during the exact peak-demand hours a human office collapses — the highest-margin days of the year become fully booked instead of half-lost, often a five-figure single-day swing.
- Convert one-time repair customers into recurring maintenance-plan members on Stripe subscriptions — predictable annual revenue, two guaranteed visits, priority loyalty, and members who never call a competitor; at scale this is the compounding asset that raises the whole business's valuation.
- Truck-roll deflection + route self-optimization: resolve trivial no-charge calls remotely and re-solve routing nightly so every freed slot and saved windshield hour gets backfilled with a paying job — directly lifting billable jobs-per-truck-per-day, the single biggest lever on a shop's profit.
- Win back lapsed customers, fill idle calendar days automatically, and offer financing on big-ticket quotes so sticker-shock no longer kills the sale — reviving dormant revenue and closing high-dollar installs that would have walked.

## 🔌 Integrations to connect
- Twilio (Voice + ConversationRelay, SMS/MMS, WhatsApp, Video, Lookup, Pay, warm transfer/conference) for the 24/7 omnichannel phone, text, and guided-diagnostic line
- Field service / CRM platforms: ServiceTitan, Housecall Pro, Jobber, ServiceFusion — for jobs, dispatch, customer + equipment records, invoicing
- Stripe (one-time card-by-voice + SMS payment links + recurring membership subscriptions)
- Google Calendar / Google Business Profile (scheduling, on-my-way, review requests) and Google Maps API (geocoding, route-aware + nightly route re-optimization)
- Supabase (ynihodbknhjirkdogxby) for biz_* scheduling engine, customer/equipment/job mirror, transcripts, gui_actions, and cross-tenant anonymized failure intelligence
- Financing partners (Wisetack / GreenSky / Synchrony) for big-ticket job financing links
- Weather + micro-weather API (e.g. NOAA/OpenWeather + elevation data) to trigger freeze/heatwave surge and parcel-level at-risk campaigns
- Supplier parts catalog/pricing feed (Ferguson, SupplyHouse, or distributor) for right-part prediction, live quoting, and continuous price-book re-benchmarking
- Utility + federal rebate/tax-credit databases (DSIRE, utility programs, IRA 25C) for net-price install quoting and rebate pre-fill

## 📝 Collect at signup (onboarding)
- Service area / zip zones covered, per-technician skills (plumbing vs HVAC, gas-certified, etc.) and working hours, plus on-call rotation and owner escalation number
- Flat-rate price book: dispatch/trip fee, common-job price ranges, after-hours/weekend/holiday emergency rates and overtime windows, and target margin per job type for re-benchmarking
- Emergency definitions + safety scripts the owner approves (gas smell, no heat threshold, sewage, major leak) and what to tell customers to do, plus which trivial issues Gui may try to resolve remotely before rolling a truck
- Maintenance-plan/membership details (price, what's included, member discounts and priority), whether financing is offered + which partner, and whether owner consents to cross-tenant anonymized failure-pattern alerts
- Booking system in use (ServiceTitan/Housecall Pro/Jobber/Google Calendar) with API access, default arrival-window length, and deposit/cancellation policy
- Languages to support (EN/PT/ES), business name/persona, Google review link, and Stripe + Twilio number connection
- Existing customer + installed-equipment list (address, brand/model/serial/age, warranty dates) to power lookup, win-back, recall cross-check, and predictive failure outreach on day one
- Local utility/jurisdiction info (utility provider per zip, permit-required job types) so rebate/tax-credit quoting and permit coordination work out of the gate
