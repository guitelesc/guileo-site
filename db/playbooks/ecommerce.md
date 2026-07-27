# 🛒 E-Commerce — Gui Agent Playbook

> Gui becomes the store that never closes and never forgets: a 24/7 multilingual concierge who answers "where's my order?", recovers every abandoned cart in minutes, re-buys for 50,000 customers at once at each person's exact run-out date, and out-sells, out-supports, and out-remembers an entire team — fused into one tireless brain that gets smarter with every conversation.

## 🟢 Core (table-stakes)
- **Order status / WISMO answers** — Caller or texter asks "where is my order?" — Gui pulls the live order by phone/email/order number, reads tracking status, carrier, and ETA, and texts the tracking link. Handles the #1 e-commerce contact reason instantly.  
  ↳ *needs:* Shopify Admin API (orders, fulfillments) + ShipStation/AfterShip tracking API; lookup by phone/email; SMS via Twilio with tracking URL
- **Product Q&A and recommendations** — Answers sizing, materials, compatibility, in-stock, color, ingredient, and "which one should I get" questions from the live catalog, then recommends and links the exact product/variant.  
  ↳ *needs:* Product catalog sync (Shopify Products API / Woo REST), variant + inventory levels, vector index of descriptions/FAQs; deep-link to PDP
- **Place order by voice/text** — Takes a full order conversationally — picks variant, quantity, confirms address, applies discount, and completes checkout via a draft order + SMS pay link or card-by-voice.  
  ↳ *needs:* Shopify Draft Orders API / checkout permalink; Stripe payment link by SMS or card-by-voice capture; address validation
- **Quote shipping, taxes, and totals** — Gives a precise out-the-door total including live shipping rates, taxes, and any active promo before the customer commits.  
  ↳ *needs:* Shopify/Woo shipping rate + tax APIs; promo/discount code engine read access
- **Take payment (Stripe link + card-by-voice)** — Sends a Stripe payment link by SMS for the cart, or captures card details over voice (PCI-compliant DTMF) to close the sale on the call.  
  ↳ *needs:* Stripe Payment Links + Twilio <Pay> PCI DTMF; order marked paid back in Shopify
- **Returns, exchanges, and refunds** — Initiates a return/exchange within policy, generates the prepaid label, books the exchange variant, and triggers the refund — fully self-serve.  
  ↳ *needs:* Returns platform API (Loop/Returnly/AfterShip Returns) or Shopify return API; carrier label API; Stripe refund API; policy ruleset
- **Discount, promo, and coupon handling** — Validates a code, explains why one failed, or issues an approved one-time code to rescue a wavering buyer, all within owner-set guardrails.  
  ↳ *needs:* Shopify Price Rules / Discount API; per-customer code generation; owner-set max discount %/budget
- **Inventory and restock answers** — Tells the customer if an item is in stock, how many left, or when it restocks, and offers a back-in-stock SMS alert they can opt into.  
  ↳ *needs:* Live inventory levels API; back-in-stock subscription store (Supabase biz_* table); restock ETA field
- **Order modification and cancellation** — Changes address, swaps a variant, adds an item, or cancels before fulfillment — editing the live order instead of forcing a support ticket.  
  ↳ *needs:* Shopify Order Edit API + fulfillment-hold check; cutoff logic vs. warehouse cutoff time
- **FAQ / policy concierge** — Answers shipping times, return windows, warranty, materials sourcing, care instructions, and store hours in the brand's voice, 24/7, in EN/PT/ES.  
  ↳ *needs:* Ingested policy/FAQ docs into RAG; brand-voice persona; language detection
- **Lead capture and human handoff** — For wholesale, custom orders, or complaints beyond policy, Gui captures full context and warm-transfers or books a callback with the owner.  
  ↳ *needs:* Twilio warm transfer + callback booking via /api/agent-schedule; gui_actions log; CRM record create

## 🔵 Advanced (proactive automations)
- **Abandoned-cart voice/text recovery** — Minutes after a cart is abandoned, Gui texts (or calls high-value carts) referencing the exact items, answers the objection that stopped them, and sends a one-tap checkout link.  
  ↳ *needs:* Shopify abandoned checkout webhook; cart contents + customer phone; Twilio SMS/voice; time-delayed trigger via Cron
- **Proactive delivery-exception rescue** — Detects a stuck, delayed, or failed-delivery shipment from carrier data and proactively texts the customer with options (reship, refund, reroute) before they ever complain.  
  ↳ *needs:* AfterShip/carrier exception webhooks; reship via Shopify; refund via Stripe; customer contact
- **Post-purchase upsell and replenishment nudge** — After a delivery confirms, Gui suggests the matching accessory, and for consumables predicts the run-out date and texts a reorder link right before they run out.  
  ↳ *needs:* Order history + product affinity rules; consumption-interval model per SKU; delivery-confirmed webhook
- **Review and UGC solicitation** — Times a review request to the moment the product has been used a few days, asks conversationally, routes happy customers to public reviews and unhappy ones privately to the owner.  
  ↳ *needs:* Delivery + dwell timer; Judge.me/Yotpo/Okendo API; sentiment branch; escalation to owner
- **VIP and loyalty concierge** — Recognizes repeat/high-LTV customers by phone, greets them by name, references past orders, applies their loyalty tier perks, and offers early access.  
  ↳ *needs:* Customer LTV + order history; loyalty platform API (Smile.io/LoyaltyLion); tier rules
- **Price-drop and wishlist alerts** — When a watched or previously-viewed item drops in price or restocks, Gui personally texts the specific customers who wanted it with a buy link.  
  ↳ *needs:* Wishlist/back-in-stock store; price-change webhook; per-customer interest map; Twilio outreach
- **Negative-review and complaint interception** — Catches a 1-2 star sentiment on a call/text in real time, de-escalates with an instant make-good (refund/credit/reship) within owner guardrails, and flags the SKU pattern to the owner.  
  ↳ *needs:* Real-time sentiment scoring; make-good budget rules; review-platform monitoring; owner alert (PushNotification)
- **Wholesale / B2B inquiry qualification** — Qualifies bulk and reseller inquiries (volume, business, region), quotes tiered pricing, and books the owner only for deals worth their time.  
  ↳ *needs:* B2B price tiers; qualification ruleset; calendar booking; CRM lead create
- **Subscription churn save** — Before a subscription renewal a likely-churn customer cancels, Gui reaches out with a pause-instead-of-cancel offer, swap, or discount to retain the recurring revenue.  
  ↳ *needs:* Recharge/Bold/Shopify Subscriptions API; cancel-intent + renewal-date data; retention offer rules
- **Multilingual market expansion** — Detects the customer's language and handles the entire sale, support, and follow-up natively in EN/PT/ES, unlocking buyers the owner couldn't serve before.  
  ↳ *needs:* Language detection; localized catalog/pricing; voice + SMS in 3 languages
- **Failed-payment and dunning recovery** — When a charge or subscription renewal declines, Gui immediately reaches the customer by text/voice, explains the issue warmly, and sends a one-tap card-update link to recover the sale before it's lost.  
  ↳ *needs:* Stripe failed-charge + subscription dunning webhooks; Stripe card-update/portal link; Twilio outreach; retry cadence rules
- **Influencer/UGC code and affiliate concierge** — Handles "do you have a code?" and creator/affiliate sign-ups, issues tracked codes, and answers affiliates' commission and payout questions without owner involvement.  
  ↳ *needs:* Affiliate platform API (Refersion/GoAffPro); Shopify discount + UTM tracking; payout-status read access

## 🟣 Superhuman (impossible for a human)
- **Mass lapsed-customer winback in one wave** — Calls and texts every dormant customer simultaneously — 500 or 50,000 — each message personalized to their exact last purchase, lapse window, and best next product, in minutes not months.  
  ↳ *needs:* Full customer DB segmentation; per-customer product-affinity model; concurrent Twilio voice/SMS at scale; call.js dial gate (DNC + caps)
- **Instant total omniscience per customer** — In the first millisecond of contact, cross-references the customer's entire order history, open tickets, shipment status, LTV, loyalty tier, reviews, and current cart — knowledge no human rep could hold for thousands of customers.  
  ↳ *needs:* Unified customer 360 store (Supabase) joining Shopify + helpdesk + tracking + loyalty + reviews; sub-second lookup by phone/email
- **Predictive replenishment at population scale** — Models the personal consumption rate of every consumable buyer and auto-triggers a reorder nudge at each individual's predicted run-out date — thousands of perfectly-timed 1:1 reorders daily.  
  ↳ *needs:* Per-SKU consumption-interval model; per-customer purchase cadence; scheduled trigger engine (Cron); reorder link generation
- **Churn and no-show prediction** — Scores every customer's churn probability and every COD/appointment order's no-show risk continuously, intervening with the right offer before the loss happens — pre-empting attrition a human never sees coming.  
  ↳ *needs:* Behavioral feature store (recency/frequency/monetary, support sentiment); churn model; intervention playbook engine
- **Real-time script and offer A/B at scale** — Runs live A/B/n tests on its own greeting, objection rebuttals, discount depth, and upsell phrasing across thousands of conversations, auto-promoting the winner per segment — continuous self-optimization.  
  ↳ *needs:* Conversation variant framework; outcome attribution (conversion/AOV); multi-armed-bandit allocator; segment-level reporting
- **Demand-spike and stockout foresight** — Detects surging interest (call/cart velocity per SKU) hours before it shows in sales, warns the owner to reorder, and proactively offers waitlists or alternatives before stockouts kill revenue.  
  ↳ *needs:* Real-time SKU interest velocity; inventory burn-down; forecast model; owner alert + auto-waitlist
- **Infinite-patience flash-sale and drop handling** — During a launch or BFCM spike, fields unlimited simultaneous calls/texts with zero hold time, charging and answering thousands of buyers at once — capacity no staffed line could match.  
  ↳ *needs:* Horizontally-scaled concurrent voice/messaging; live inventory guard to prevent oversell; Stripe at volume
- **Perfect forever-memory 1:1 personalization** — Remembers every customer's name, preferences, sizes, past complaints, kids' birthdays mentioned once, and favorite products forever — making every future contact feel like a lifelong relationship across millions of people.  
  ↳ *needs:* Persistent per-customer memory store (Supabase, append-only); preference/entity extraction from every interaction; recall at contact time
- **Cross-customer fraud and abuse pattern detection** — Spots return-abuse rings, promo-stacking, and chargeback-prone behavior by correlating patterns across the entire customer base in real time — protecting margin in ways a single rep can't perceive.  
  ↳ *needs:* Cross-customer behavioral graph; return/chargeback history; risk scoring; owner alert + auto-policy enforcement
- **Omnichannel context continuity** — A customer starts on WhatsApp, calls an hour later, then texts at midnight — Gui carries the full thread seamlessly across all channels with no repetition, something no shift-based human team can do.  
  ↳ *needs:* Unified conversation thread keyed to customer identity across Twilio voice/SMS/WhatsApp; shared session memory
- **Continuous full-catalog dynamic pricing and margin optimization** — Watches competitor prices, demand velocity, inventory age, and per-customer willingness-to-pay across every SKU at once, recommending or auto-setting the profit-maximizing price and the smallest discount that still closes each individual buyer — pricing decisions no human could make per-SKU, per-customer, in real time.  
  ↳ *needs:* Competitor price-scrape feed; demand + inventory-age signals; per-customer elasticity model; Shopify price/discount write API within owner margin floors
- **Whole-base margin-aware discount arbitration** — For every recovery, winback, and save offer across thousands of simultaneous conversations, computes the exact minimum incentive each customer needs to convert given their elasticity and LTV — never over-discounting, capturing the full margin a fixed coupon throws away.  
  ↳ *needs:* Per-customer elasticity + LTV model; live margin data per SKU; bandit-tuned offer depth; global promo-budget ledger (Supabase)
- **Auto-generated 1:1 product bundles and personalized landing pages** — For each customer it instantly assembles a custom bundle and a one-tap personalized checkout/landing page from their browse + purchase history — thousands of unique, individually-merchandised storefronts generated on the fly, impossible to hand-build.  
  ↳ *needs:* Per-customer affinity + co-purchase graph; Shopify draft-order/bundle + permalink generation; dynamic landing-page render; deep-link by SMS
- **Zero-latency multilingual scale across every channel at once** — Holds thousands of simultaneous conversations across voice, SMS, and WhatsApp in EN/PT/ES (and beyond) with no hold time and no quality drop — serving every global timezone at 3am as well as noon, a follow-the-sun team of infinite size.  
  ↳ *needs:* Concurrent multilingual voice/SMS/WhatsApp infra; per-language brand-voice persona; 24/7 always-on with no shift gaps
- **Real-time inventory-aware sell-through orchestration** — Knowing exact live stock per SKU, Gui steers thousands of in-flight conversations to push aging/overstock inventory and protect scarce hot items — auto-substituting alternatives the instant something sells out, so it never sells what isn't there and never lets dead stock sit.  
  ↳ *needs:* Live inventory + inventory-age feed; substitution graph; conversation-level recommendation override; oversell guard at checkout
- **Continuous catalog + review mining for product and listing fixes** — Reads every conversation, review, and return reason across the whole base to surface which SKU runs small, which listing photo misleads, and which description drives returns — then auto-drafts the corrected copy and flags the owner, a QA pass on the entire catalog no human could sustain.  
  ↳ *needs:* Cross-conversation + review + return-reason aggregation; per-SKU defect/complaint clustering; listing copy generation; owner approval queue

## 💰 Killer revenue moves
- Abandoned-cart + failed-payment recovery at scale — instant personalized voice/text on every abandoned checkout (60-70% of carts abandon) AND every declined charge/dunning event; recovering even 10-15% of carts plus reclaiming otherwise-lost paid orders is consistently the single largest revenue lift Gui delivers, often paying for itself in week one.
- Mass lapsed-customer winback waves — reactivating dormant buyers with 1:1 personalized reorder offers turns a dead email list into immediate cash with near-zero marginal cost; one wave can outproduce a month of paid ads.
- Predictive replenishment + subscription churn saves — auto-timed reorder nudges at each customer's run-out date plus pause-instead-of-cancel saves compound LTV and stabilize recurring revenue, the highest-multiple line on the P&L.
- Margin-aware dynamic discounting + 1:1 upsell/bundle at the point of sale — issuing the smallest incentive each buyer actually needs (never over-discounting) while raising AOV with personalized bundles protects and grows profit on every single order, not just the top line.
- Flash-sale / drop / BFCM infinite capacity — fielding unlimited simultaneous buyers with zero hold time and live oversell protection captures peak-day revenue that staffed lines physically drop, turning the year's biggest hours into uncapped sales.

## 🔌 Integrations to connect
- Shopify Admin API (orders, products, inventory, draft orders, order edit, discounts, price rules, abandoned checkouts) — and WooCommerce REST API for Woo sellers
- Stripe (Payment Links, card-by-voice via Twilio Pay, refunds, failed-charge + subscription dunning webhooks, card-update/portal links) and Shop Pay / shop payment status sync
- Twilio (Programmable Voice, SMS, WhatsApp Business API) for omnichannel contact + PCI DTMF card capture, plus call.js dial gate for DNC/caps at winback scale
- Shipping & tracking: ShipStation, AfterShip, EasyPost / carrier APIs (USPS, UPS, FedEx, DHL) for live ETAs and exception webhooks
- Returns & post-purchase: Loop Returns / Returnly / AfterShip Returns; review platforms Judge.me / Yotpo / Okendo; loyalty Smile.io / LoyaltyLion; affiliate Refersion / GoAffPro
- Subscriptions: Recharge / Bold / Shopify Subscriptions; helpdesk Gorgias / Zendesk; competitor price-scrape feed for dynamic pricing; and Guileo's own Supabase customer-360 + scheduling engine (biz_* tables, /api/agent-schedule) + Cron trigger engine for replenishment/winback timing

## 📝 Collect at signup (onboarding)
- Store platform + credentials: Shopify store URL & Admin API access (or Woo store + REST keys), plus the storefront domain for deep-link and personalized-landing-page generation
- Payment + refund setup: Stripe account connect, whether card-by-voice is enabled, dunning/failed-payment recovery on, and refund/credit authority limits Gui may act on without approval
- Catalog, margin & policy docs: product catalog access (auto-synced) with per-SKU cost/margin floors for dynamic pricing, plus shipping policy, return/exchange window, warranty, and FAQ documents to ingest
- Shipping & returns stack: which carriers and tracking provider (ShipStation/AfterShip), and returns platform + prepaid-label rules
- Discount, pricing & guardrails: max discount % and monthly promo budget Gui can offer, margin floors and whether auto-repricing is allowed, approved win-back/save offers, and which actions need owner sign-off
- Channels, languages & escalation: phone/SMS/WhatsApp numbers to operate, languages to support (EN/PT/ES), business hours, DNC/contact-cap preferences for winback waves, and the owner contact for warm transfers / high-value or complaint escalations
